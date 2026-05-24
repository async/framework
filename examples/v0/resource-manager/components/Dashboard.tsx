import { computed, createRouter, iif, Signal, signal } from "@async/framework-v0";
import { getResources, type Resource } from "../data/mock.ts";

export function Dashboard({
  router,
}: {
  router: ReturnType<typeof createRouter>;
}) {
  const resources = signal<Resource[]>([]);
  const loading = signal(true);

  // Load resources
  getResources().then((data) => {
    resources.value = data.value;
    loading.value = false;
  });

  // Computed statistics
  const stats = computed(() => ({
    total: resources.value.length,
    active: resources.value.filter((r) => r.status === "active").length,
    error: resources.value.filter((r) => r.status === "error").length,
    avgUsage: Math.round(
      resources.value.reduce((acc, r) => acc + r.usage, 0) /
        resources.value.length,
    ),
    byType: {
      server: resources.value.filter((r) => r.type === "server").length,
      database: resources.value.filter((r) => r.type === "database").length,
      storage: resources.value.filter((r) => r.type === "storage").length,
    },
  }));

  return iif(
    loading,
    () => {
      return (
        <div class="text-center py-8">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto">
          </div>
        </div>
      );
    },
    () => (
      <div class="flex flex-col gap-6">
        <h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="bg-white rounded-lg shadow-md p-6">
            <h3 class="text-lg font-semibold text-gray-900">Total Resources</h3>
            <p class="text-3xl font-bold text-blue-500 mt-2">
              {iif(stats, (val: any) => val.total)}
            </p>
          </div>

          <div class="bg-white rounded-lg shadow-md p-6">
            <h3 class="text-lg font-semibold text-gray-900">
              Active Resources
            </h3>
            <p class="text-3xl font-bold text-green-500 mt-2">
              {iif(stats, (val: any) => val.active)}
            </p>
          </div>

          <div class="bg-white rounded-lg shadow-md p-6">
            <h3 class="text-lg font-semibold text-gray-900">
              Resources in Error
            </h3>
            <p class="text-3xl font-bold text-red-500 mt-2">
              {iif(stats, (val: any) => val.error)}
            </p>
          </div>

          <div class="bg-white rounded-lg shadow-md p-6">
            <h3 class="text-lg font-semibold text-gray-900">Average Usage</h3>
            <p class="text-3xl font-bold text-purple-500 mt-2">
              {iif(stats, (val: any) => val.avgUsage)}%
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-white rounded-lg shadow-md p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">
              Resources by Type
            </h3>
            <div class="flex flex-col gap-4">
              <div>
                <div class="flex justify-between mb-1">
                  <span class="text-sm font-medium">Servers</span>
                  <span class="text-sm text-gray-600">
                    {iif(stats, (val: any) => val.byType.server)}
                  </span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div
                    class="bg-blue-500 h-2 rounded-full"
                    style={computed(
                      () =>
                        `width: ${
                          (stats.value.byType.server / stats.value.total) * 100
                        }%`,
                    )}
                  >
                  </div>
                </div>
              </div>

              <div>
                <div class="flex justify-between mb-1">
                  <span class="text-sm font-medium">Databases</span>
                  <span class="text-sm text-gray-600">
                    {stats.value.byType.database}
                  </span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div
                    class="bg-green-500 h-2 rounded-full"
                    style={`width: ${
                      (stats.value.byType.database / stats.value.total) * 100
                    }%`}
                  >
                  </div>
                </div>
              </div>

              <div>
                <div class="flex justify-between mb-1">
                  <span class="text-sm font-medium">Storage</span>
                  <span class="text-sm text-gray-600">
                    {stats.value.byType.storage}
                  </span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div
                    class="bg-purple-500 h-2 rounded-full"
                    style={`width: ${
                      (stats.value.byType.storage / stats.value.total) * 100
                    }%`}
                  >
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-md p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">
              Recent Activity
            </h3>
            <div class="flex flex-col gap-4">
              {iif(resources, (val) =>
                val
                  .sort(
                    (a, b) =>
                      new Date(b.lastUpdated).getTime() -
                      new Date(a.lastUpdated).getTime(),
                  )
                  .slice(0, 5)
                  .map((resource) => (
                    <div
                      key={resource.id}
                      class="flex justify-between items-center"
                    >
                      <div>
                        <p class="font-medium">{resource.name}</p>
                        <p class="text-sm text-gray-600">
                          {new Date(resource.lastUpdated).toLocaleString()}
                        </p>
                      </div>
                      <span
                        class={`px-2 py-1 rounded-full text-xs font-medium ${
                          resource.status === "active"
                            ? "bg-green-100 text-green-800"
                            : resource.status === "inactive"
                            ? "bg-gray-100 text-gray-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {resource.status}
                      </span>
                    </div>
                  )))}
            </div>
          </div>
        </div>
      </div>
    ),
  );
}
