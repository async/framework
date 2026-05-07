/** @jsx jsx */
/** @jsxFrag Fragment */
import {
  createAsyncFramework,
  createRouterMachine,
  Fragment,
  jsx,
  mountReactive,
  signal,
} from "../../index.ts";

const root = document.querySelector("#app");
const framework = createAsyncFramework({ root });

const router = createRouterMachine({
  routes: [
    { id: "home", path: "/" },
    { id: "ticket", path: "/tickets/:id" },
    { id: "settings", path: "/settings" },
  ],
});

const pathInput = signal("/tickets/42");

framework.handlers.registerHandlers({
  "router/go-home": () => router.navigate("/"),
  "router/go-ticket": () => router.navigate("/tickets/42"),
  "router/go-settings": () => router.navigate("/settings"),
  "router/update-path": ({ element }) => {
    pathInput.value = element.value;
  },
  "router/go-custom": () => router.navigate(pathInput.value),
});

router.start();

function App() {
  const current = router.current.value;
  return (
    <section>
      <h1>Router Machine</h1>
      <p>Machine state: <strong>{router.machine.state}</strong></p>
      <p>Path: <strong>{current.path}</strong></p>
      <p>Route: <strong>{current.route?.id ?? "not_found"}</strong></p>
      <pre>{JSON.stringify(current.params, null, 2)}</pre>

      <div>
        <button {...{"on:click": "router/go-home"}}>Home</button>
        <button {...{"on:click": "router/go-ticket"}}>Ticket 42</button>
        <button {...{"on:click": "router/go-settings"}}>Settings</button>
      </div>

      <div>
        <input value={pathInput.value} {...{"on:input": "router/update-path"}} />
        <button {...{"on:click": "router/go-custom"}}>Go custom</button>
      </div>
    </section>
  );
}

mountReactive(root, () => App());
framework.start();
