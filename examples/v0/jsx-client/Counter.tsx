import { AsyncLoaderContext, cls, computed, signal } from "@async/framework-v0";

export function onUpdate(context: AsyncLoaderContext<string>) {
  // console.log("Counter.module", context.module);
  console.log("Counter.onUpdate", context.value);
}

export function Counter() {
  const count = signal(0);
  const theme = signal<"light" | "dark">("light");

  // Create computed signals that automatically track dependencies
  const isDark = computed(() => theme.value === "dark");
  const isPositive = computed(() => count.value > 0);
  const isNegative = computed(() => count.value < 0);
  const isZero = computed(() => count.value === 0);
  const doubled = computed(() => count.value * 2);
  const tripled = computed(() => count.value * 3);

  // Example of using track directly
  const classes = computed(() =>
    cls("rounded-lg shadow-md p-6", {
      "bg-gray-800": isDark.value,
      "bg-white": !isDark.value,
    })
  );

  return (
    <div class={classes}>
      <div class="flex justify-between items-center mb-4">
        <h2
          class={computed(() =>
            cls("text-2xl font-semibold", {
              "text-white": isDark.value,
              "text-gray-800": !isDark.value,
            })
          )}
        >
          <div>
            <div>Rendering edge cases</div>
          </div>
          <div class="text-red-500">
            Count: {count} Doubled: {doubled} Tripled: {tripled}
          </div>
          <div>
            Count: <span>{count}</span> Doubled: <span>{doubled}</span> Tripled:
            {" "}
            <span>{tripled}</span>
          </div>
        </h2>
        <button
          onClick={() => (theme.value = theme.value === "light"
            ? "dark"
            : "light")}
          class="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 transition-colors"
        >
          Toggle Theme
        </button>
      </div>

      <div class="flex gap-4">
        <button
          class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          onClick={() => count.value++}
        >
          Increment
        </button>
        <button
          class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
          onClick={() => count.value--}
        >
          Decrement
        </button>
        <button
          class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
          onClick={() => (count.value = 0)}
        >
          Reset
        </button>
      </div>

      <div
        class={computed(() =>
          cls("mt-4 p-4 rounded-md", {
            "bg-green-100 text-green-800": isPositive.value,
            "bg-red-100 text-red-800": isNegative.value,
            "bg-gray-100 text-gray-800": isZero.value,
          })
        )}
      >
        {computed(() =>
          count.value > 0
            ? "Number is positive!"
            : count.value < 0
            ? "Number is negative!"
            : "Number is zero!"
        )}
      </div>
    </div>
  );
}
