// Why: Provides a type-safe way to handle conditional classes based on signals
export function cls(
  ...inputs: (string | Record<string, boolean | (() => boolean)>)[]
) {
  const classes: string[] = [];

  for (const input of inputs) {
    if (typeof input === "string") {
      classes.push(input);
    } else {
      for (const [className, condition] of Object.entries(input)) {
        if (typeof condition === "function") {
          if (condition()) classes.push(className);
        } else if (condition) {
          classes.push(className);
        }
      }
    }
  }

  return classes.join(" ");
}
