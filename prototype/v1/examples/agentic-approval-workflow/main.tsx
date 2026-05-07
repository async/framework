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
  idle: { START: "executing" },
  executing: { WAIT_FOR_APPROVAL: "waiting_for_approval", COMPLETE: "completed", FAIL: "failed" },
  waiting_for_approval: { APPROVE: "executing", REJECT: "cancelled" },
  completed: {},
  failed: {},
  cancelled: {},
});

const runtime = createRuntimeService({ machine, commands });
const runState = signal(machine.state);
const timeline = signal([machine.state]);
const logs = signal(["runtime initialized"]);

runtime.subscribe((event) => {
  if (event.type === "TRANSITION") {
    runState.value = runtime.state;
    timeline.value = [...timeline.value, runtime.state];
  }
  logs.value = [...logs.value, JSON.stringify(event)];
});

commands.on("WORKFLOW_START", async () => {
  runtime.transition({ type: "START" });
  logs.value = [...logs.value, "drafting outbound recommendation"];
  await sleep(250);
  runtime.requestApproval({
    runId: "approval-run-1",
    taskId: "approve-send",
    reason: "send customer response",
  });
});

commands.on("WORKFLOW_APPROVE", async () => {
  runtime.transition({ type: "APPROVE" });
  await sleep(250);
  runtime.transition({ type: "COMPLETE" });
});

commands.on("WORKFLOW_REJECT", async () => {
  runtime.transition({ type: "REJECT" });
});

framework.handlers.registerHandlers({
  "approval/start": async () => await runtime.dispatch({ type: "WORKFLOW_START" }),
  "approval/approve": async () => await runtime.dispatch({ type: "WORKFLOW_APPROVE" }),
  "approval/reject": async () => await runtime.dispatch({ type: "WORKFLOW_REJECT" }),
});

function App() {
  return (
    <div>
      <h1>Approval Workflow Agent</h1>
      <p>State: <strong>{runState.value}</strong></p>
      <div>
        <button {...{"on:click": "approval/start"}}>Start Workflow</button>
        <button {...{"on:click": "approval/approve"}}>Approve</button>
        <button {...{"on:click": "approval/reject"}}>Reject</button>
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
