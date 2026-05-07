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
const runMachine = createRunMachine("idle", {
  idle: { START: "planning" },
  planning: { PLAN_READY: "executing", FAIL: "failed" },
  executing: { WAIT_FOR_APPROVAL: "waiting_for_approval", COMPLETE: "completed", FAIL: "failed" },
  waiting_for_approval: { APPROVE: "executing", REJECT: "cancelled" },
  completed: {},
  failed: {},
  cancelled: {},
});

const runtime = createRuntimeService({ machine: runMachine, commands });

const runState = signal(runMachine.state);
const timeline = signal(["idle"]);
const logs = signal(["runtime initialized"]);

function addLog(message: string) {
  logs.value = [...logs.value, message];
}

runtime.subscribe((event) => {
  if (event.type === "TRANSITION") {
    runState.value = runtime.state;
    timeline.value = [...timeline.value, runtime.state];
  }
  addLog(JSON.stringify(event));
});

commands.on("RUN_START", async () => {
  runtime.transition({ type: "START" });
  addLog("planning run...");
  await sleep(300);
  runtime.transition({ type: "PLAN_READY" });

  addLog("executing first task...");
  await sleep(300);
  runtime.requestApproval({
    runId: "run-1",
    taskId: "task-approval-1",
    reason: "send outbound message",
  });

  return { runId: "run-1" };
});

commands.on("RUN_APPROVE", async () => {
  runtime.transition({ type: "APPROVE" });
  await sleep(250);
  runtime.transition({ type: "COMPLETE" });
});

commands.on("RUN_CANCEL", async () => {
  runtime.transition({ type: "REJECT" });
});

framework.handlers.registerHandlers({
  "app/start": async () => await runtime.dispatch({ type: "RUN_START" }),
  "app/approve": async () => await runtime.dispatch({ type: "RUN_APPROVE" }),
  "app/cancel": async () => await runtime.dispatch({ type: "RUN_CANCEL" }),
});

function App() {
  return (
    <div>
      <h1>Agentic Run Demo</h1>
      <p>Current state: <strong>{runState.value}</strong></p>

      <div>
        <button {...{"on:click": "app/start"}}>Start Run</button>
        <button {...{"on:click": "app/approve"}}>Approve</button>
        <button {...{"on:click": "app/cancel"}}>Cancel</button>
      </div>

      <h2>Timeline</h2>
      <ol>
        {timeline.value.map((step) => <li>{step}</li>)}
      </ol>

      <h2>Event Log</h2>
      <pre>{logs.value.join("\n")}</pre>
    </div>
  );
}

mountReactive(root, () => App());
framework.start();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
