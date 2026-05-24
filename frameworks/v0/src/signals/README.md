# Custom Signals Package

This package provides a reactive programming model using signals. Signals are
values that can change over time and automatically update any computations that
depend on them.

## Key Components

1. Signal: Represents a value that can change over time.
2. computed: Creates a signal that depends on other signals and updates
   automatically.
3. SignalRegistry: Manages all signals and their dependencies.

## How to Use

### Creating a Signal

To create a simple signal:

```jsx
import { signal } from "./signals";

const countSignal = signal(0);
```

### Reading and Writing to a Signal

```jsx
// Read the current value
console.log(countSignal.value); // 0
// or using the get method
console.log(countSignal.get()); // 0

// Update the value
countSignal.value = 1;
// or using the set method
countSignal.set(1);
```

### Alternative Signal Creation

You can also create a signal using the createSignal helper:

```jsx
import { createSignal } from "./signals";

const [getCount, setCount, countSignal] = createSignal(0);

// Using the getter and setter
console.log(getCount()); // 0
setCount(1);
```

### Creating a Computed Signal

Computed signals automatically update when their dependencies change:

```jsx
import { computed } from "./signals";

const doubleCount = computed(() => countSignal.value * 2);

console.log(doubleCount.value); // 2

countSignal.value = 2;
console.log(doubleCount.value); // 4
```

### Subscribing to Changes

You can subscribe to changes in a signal:

```jsx
const unsubscribe = countSignal.subscribe((newValue, oldValue) => {
  console.log(`Count changed from ${oldValue} to ${newValue}`);
});

// Later, to stop listening:
unsubscribe();
```

### Using SignalRegistry

The SignalRegistry provides a centralized way to manage signals:

```jsx
import { SignalRegistry } from "./registry";

const registry = new SignalRegistry();

// Get or create a signal
const mySignal = registry.getOrCreate("mySignal", "initial value");

// Update or create a signal
const updatedSignal = registry.updateOrCreate("mySignal", "new value");

// Check if a signal exists
if (registry.has("mySignal")) {
  console.log("Signal exists");
}

// Remove a signal
registry.remove("mySignal");

// Clear all signals
registry.clear();
```

## Best Practices

1. Use meaningful names for your signals to make debugging easier
2. Clean up signal subscriptions when they're no longer needed
3. Avoid circular dependencies in computed signals
4. Use computed signals for derived values instead of manually updating them
5. Consider using the debugSignal wrapper during development for better
   debugging

## Debugging

For development and debugging, you can use the debugSignal wrapper:

```jsx
import { debugSignal, signal } from "./signals";

const count = debugSignal(signal(0), "count");
```

This will log all operations (get, set, subscribe, track) performed on the
signal.

## TypeScript Support

The signals package is written in TypeScript and provides full type safety:

```jsx
const numberSignal = signal < number > (0);
const stringSignal = signal < string > ("hello");
const complexSignal =
  signal < { id: number, name: string } > ({ id: 1, name: "test" });
```

## Advanced Features

1. Signal tracking for automatic dependency detection
2. Read-only signals using readSignal
3. Custom computation tracking using the track method
4. Efficient update propagation that avoids unnecessary recomputations

Remember that signals are designed to be efficient and automatically manage
dependencies. In most cases, using the basic signal, computed, and subscription
methods will be sufficient for building reactive applications.

```
```
