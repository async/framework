import {
  computed,
  createResource,
  createRouter,
  iif,
  isSignal,
  signal,
} from "@async/framework-v0";
import { getResources, type Resource } from "../data/mock.ts";

export function ResourceList({
  router,
}: {
  router: ReturnType<typeof createRouter>;
}) {
  const searchQuery = signal("");
  const selectedType = signal<Resource["type"] | "all">("all");

  // Use createResource with tracking
  const {
    data: resources,
    loading,
    // error,
    dispose,
  } = createResource(async (track) => {
    // Track dependencies that should trigger a reload
    const type = track(() => selectedType.value);

    // Get resources and filter by type if needed
    const result = await getResources();
    if (type === "all") {
      return result;
    }

    // If result is a signal, we need to create a new computed signal
    if (isSignal(result)) {
      return computed(() => {
        const items = result.value;
        return items.filter((item) => item.type === type);
      });
    }

    // If it's a direct value, just filter it
    // @ts-expect-error: if its not a signal, it's a Resource[]
    return result.filter((item) => item.type === type);
  });
  console.log("ResourceList: mounted");

  // Cleanup when component is disconnected
  const subscription = router.current.subscribe(({ path }) => {
    if (path !== "/resources/" && path !== "/") {
      console.warn("ResourceList: dispose");
      dispose();
      subscription();
    } else {
      console.log("ResourceList: load");
    }
  });

  // Fix the value binding issues
  const searchValue = computed(() => searchQuery.value);
  const typeValue = computed(() => selectedType.value);

  // Update filteredResources to handle undefined initial state
  const filteredResources = computed(() => {
    const resourcesValue = resources.value;
    const selectedTypeValue = selectedType.value;
    const searchQueryValue = searchQuery.value;
    if (!resourcesValue) return [];

    return resourcesValue.filter(
      (resource) =>
        resource.name.toLowerCase().includes(searchQueryValue.toLowerCase()) &&
        (selectedTypeValue === "all" || resource.type === selectedTypeValue),
    );
  });

  return (
    <div class="flex flex-col gap-6">
      <div class="flex justify-between items-center">
        <h1 class="text-3xl font-bold text-gray-900">Resources</h1>
        <div class="flex gap-4">
          <input
            type="text"
            placeholder="Search resources..."
            value={searchValue}
            onInput={(e) => {
              if (e.target instanceof HTMLInputElement) {
                searchQuery.value = e.target.value;
              }
            }}
            class="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={typeValue}
            onChange={(e) => {
              if (e.target instanceof HTMLSelectElement) {
                selectedType.value = e.target.value as Resource["type"] | "all";
              }
            }}
            class="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="server">Server</option>
            <option value="database">Database</option>
            <option value="storage">Storage</option>
          </select>
        </div>
      </div>

      {/* Show error state if there is an error */}
      {
        /* {iif(
        error,
        (err) => (
          <div class="text-red-500 p-4 rounded bg-red-50">
            Error: {err.message}
          </div>
        ),
        () => */
        iif(
          loading,
          () => (
            <div class="text-center py-8">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto">
              </div>
            </div>
          ),
          () => (
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {iif(filteredResources, (data) =>
                data.map((resource) => (
                  <div
                    key={resource.id}
                    class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => router.navigate(`/resources/${resource.id}`)}
                  >
                    <div class="flex justify-between items-start">
                      <h3 class="text-lg font-semibold text-gray-900">
                        {resource.name}
                      </h3>
                      <span
                        class={computed(
                          () =>
                            `px-2 py-1 rounded-full text-xs font-medium ${
                              resource.status === "active"
                                ? "bg-green-100 text-green-800"
                                : resource.status === "inactive"
                                ? "bg-gray-100 text-gray-800"
                                : "bg-red-100 text-red-800"
                            }`,
                        )}
                      >
                        {resource.status}
                      </span>
                    </div>
                    <p class="text-sm text-gray-600 mt-2">
                      Type: {resource.type}
                    </p>
                    <div class="mt-4">
                      <div class="w-full bg-gray-200 rounded-full h-2">
                        <div
                          class={computed(
                            () =>
                              `h-2 rounded-full ${
                                resource.usage > 80
                                  ? "bg-red-500"
                                  : resource.usage > 50
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                              }`,
                          )}
                          style={`width: ${resource.usage}%`}
                        >
                        </div>
                      </div>
                      <p class="text-xs text-gray-600 mt-1">
                        Usage: {resource.usage}%
                      </p>
                    </div>
                  </div>
                )))}
            </div>
          ),
        )
      }
    </div>
  );
}
