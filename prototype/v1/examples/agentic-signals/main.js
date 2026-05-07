/** @jsx jsx */
/** @jsxFrag Fragment */
import {
  createAsyncFramework,
  computed,
  createSignalRegistry,
  Fragment,
  jsx,
  mountReactive,
} from "../../index.ts";

const root = document.querySelector("#app");
const framework = createAsyncFramework({ root });

const registry = createSignalRegistry();
const runState = registry.ensure("run.state", "idle");
const logs = registry.ensure("run.logs", ["idle"]);
const status = computed(() =>
  runState.value === "waiting_for_approval"
    ? "Awaiting human approval"
    : `Current: ${runState.value}`
);

const appendLog = (entry) => {
  logs.value = [...logs.value, entry];
};

framework.handlers.registerHandlers({
  "run/start": async () => {
    runState.value = "executing";
    appendLog("executing");
    await sleep(300);
    runState.value = "waiting_for_approval";
    appendLog("waiting_for_approval");
  },
  "run/approve": () => {
    if (runState.value !== "waiting_for_approval") return;
    runState.value = "completed";
    appendLog("completed");
  },
});

function App() {
  return (
    <section>
      <button {...{"on:click": "run/start"}}>Start</button>
      <button {...{"on:click": "run/approve"}}>Approve</button>
      <p id="state">Run state: {runState.value}</p>
      <p id="status">{status.value}</p>
      <pre id="logs">{logs.value.join("\n")}</pre>
    </section>
  );
}

mountReactive(root, () => App());
framework.start();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
