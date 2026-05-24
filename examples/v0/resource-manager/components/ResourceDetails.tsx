import { createRouter, iif, signal } from "@async/framework-v0";
import { getResourceById, type Resource } from "../data/mock.ts";

export function ResourceDetails({
  id,
  router,
}: {
  id: string;
  router: ReturnType<typeof createRouter>;
}) {
  const resource = signal<Resource | null>(null);
  const loading = signal(true);
  const error = signal<string | null>(null);

  // Load resource details
  getResourceById(id).then((data) => {
    if (data) {
      resource.value = data;
    } else {
      error.value = "Resource not found";
    }
    loading.value = false;
  });

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
    () => {
      if (error.value) {
        return (
          <div class="max-w-3xl mx-auto">
            <div class="mb-6">
              <button
                onClick={() => router.navigate("/resources/")}
                class="text-blue-500 hover:text-blue-700 flex items-center"
              >
                <span>← Back to Resources</span>
              </button>
            </div>
            <div class="bg-white rounded-lg shadow-md p-6">
              <div class="text-center py-8 text-red-600">{error.value}</div>
            </div>
          </div>
        );
      }
      if (!resource.value) return null;

      return (
        <div class="max-w-3xl mx-auto">
          <div class="mb-6">
            <button
              onClick={() => router.navigate("/resources/")}
              class="text-blue-500 hover:text-blue-700 flex items-center"
            >
              ← Back to Resources
            </button>
          </div>

          <div class="bg-white rounded-lg shadow-md p-6">
            <div class="flex justify-between items-start mb-6">
              <h1 class="text-3xl font-bold text-gray-900">
                {resource.value.name}
              </h1>
              <span
                class={`px-3 py-1 rounded-full text-sm font-medium ${
                  resource.value.status === "active"
                    ? "bg-green-100 text-green-800"
                    : resource.value.status === "inactive"
                    ? "bg-gray-100 text-gray-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {resource.value.status}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-6">
              <div>
                <h3 class="text-lg font-semibold mb-2">Details</h3>
                <dl class="flex flex-col gap-2">
                  <div>
                    <dt class="text-sm text-gray-600">ID</dt>
                    <dd class="text-sm font-medium">{resource.value.id}</dd>
                  </div>
                  <div>
                    <dt class="text-sm text-gray-600">Type</dt>
                    <dd class="text-sm font-medium capitalize">
                      {resource.value.type}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-sm text-gray-600">Last Updated</dt>
                    <dd class="text-sm font-medium">
                      {new Date(resource.value.lastUpdated).toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 class="text-lg font-semibold mb-2">Usage</h3>
                <div class="mt-2">
                  <div class="w-full bg-gray-200 rounded-full h-4">
                    <div
                      class={`h-4 rounded-full ${
                        resource.value.usage > 80
                          ? "bg-red-500"
                          : resource.value.usage > 50
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                      style={`width: ${resource.value.usage}%`}
                    >
                    </div>
                  </div>
                  <p class="text-sm text-gray-600 mt-1">
                    Current usage: {resource.value.usage}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    },
  );
}
