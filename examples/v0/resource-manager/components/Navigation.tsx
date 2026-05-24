import { createRouter } from "@async/framework-v0";
import { computed } from "@async/framework-v0";

export function Navigation({
  router,
}: {
  router: ReturnType<typeof createRouter>;
}) {
  const currentPath = computed(() => router.current.value.path);

  console.log("Navigation: currentPath", currentPath.value);
  return (
    <nav class="bg-white shadow-md">
      <div class="container mx-auto px-4">
        <div class="flex items-center justify-between h-16">
          <div class="flex gap-4">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                router.navigate("/dashboard/");
              }}
              class={computed(
                () =>
                  `px-3 py-2 rounded-md text-sm font-medium ${
                    currentPath.value.startsWith("/dashboard/")
                      ? "bg-blue-500 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`,
              )}
            >
              Dashboard
            </a>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                router.navigate("/resources/");
              }}
              class={computed(
                () =>
                  `px-3 py-2 rounded-md text-sm font-medium ${
                    currentPath.value.startsWith("/resources/") ||
                      currentPath.value === "/"
                      ? "bg-blue-500 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`,
              )}
            >
              Resources
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
