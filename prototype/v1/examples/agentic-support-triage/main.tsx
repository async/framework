/** @jsx jsx */
/** @jsxFrag Fragment */
import {
  createAsyncFramework,
  createCommandBus,
  createRunMachine,
  createRuntimeService,
  Fragment,
  jsx,
  mountReactive,
  signal,
} from "../../index.ts";

const root = document.querySelector("#app") as Element;
const framework = createAsyncFramework({ root });
const commands = createCommandBus();

const machine = createRunMachine("idle", {
  idle: { START: "planning" },
  planning: { PLAN_READY: "executing", FAIL: "failed" },
  executing: { COMPLETE: "completed", FAIL: "failed" },
  completed: { RETRY: "planning" },
  failed: { RETRY: "planning" },
});

const runtime = createRuntimeService({ machine, commands });
const runState = signal(machine.state);
const timeline = signal([machine.state]);
const logs = signal(["runtime initialized"]);
const lastCommand = signal("none");

const addLog = (m: string) => (logs.value = [...logs.value, m]);

runtime.subscribe((event: any) => {
  if (event.command?.type) lastCommand.value = event.command.type;
  if (event.type === "TRANSITION") {
    runState.value = runtime.state;
    timeline.value = [...timeline.value, runtime.state];
  }
  addLog(JSON.stringify(event));
});

commands.on("TRIAGE_START", async () => {
  runtime.transition({ type: "START" });
  addLog("planning inbox triage");
  await sleep(250);
  runtime.transition({ type: "PLAN_READY" });
  addLog("executing task routing + summarization");
  await sleep(250);
  runtime.transition({ type: "COMPLETE" });
});

commands.on("TRIAGE_RETRY", async () => {
  runtime.transition({ type: "RETRY" });
  await runtime.dispatch({ type: "TRIAGE_START" });
});

framework.handlers.registerHandlers({
  "triage/start": async () => await runtime.dispatch({ type: "TRIAGE_START" }),
  "triage/retry": async () => await runtime.dispatch({ type: "TRIAGE_RETRY" }),
});

function App() {
  return (
    <div>
      <h1>Support Triage Agent</h1>
      <p>State: <strong>{runState.value}</strong></p>
      <p>Last command: <strong>{lastCommand.value}</strong></p>
      <div>
        <button {...{"on:click": "triage/start"}}>Start Triage</button>
        <button {...{"on:click": "triage/retry"}}>Retry</button>
      </div>
      <h2>Timeline</h2>
      <ol>{timeline.value.map((step) => <li>{step}</li>)}</ol>
      <h2>Runtime log</h2>
      <pre>{logs.value.join("\n")}</pre>
    </div>
  );
}

mountReactive(root, () => App());
framework.start();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
