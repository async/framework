/** @jsx jsx */
/** @jsxFrag Fragment */
import {
  createAsyncFramework,
  Fragment,
  jsx,
  mountReactive,
} from "../../index.ts";
import { remoteCount } from "./signals.js";

const app = document.querySelector("#app");
const framework = createAsyncFramework({ root: app });

await framework.handlers.registerRemoteManifest("./registry.json", {
  baseUrl: import.meta.url,
});

function App() {
  return (
    <button
      on:click="remote:counter"
      on:mouseenter="remote:hover"
      on:mouseleave="remote:hover"
      data-remote-count={remoteCount.value}
    >
      Remote handler clicks: {remoteCount.value}
    </button>
  );
}

mountReactive(app, () => App());
framework.start();
