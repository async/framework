import {
  component,
  signal
} from "@async/framework/jsx";

const count = signal(0);

export default component(() => (
  <main>
    <button type="button" onClick={() => count.value++}>Add</button>
    <strong>{count}</strong>
  </main>
));
