import {
  createAsyncFramework,
  createCommandBus,
  createRunMachine,
  createRuntimeService,
  computed,
  effect,
  registerCommandHandlers,
  signal,
} from "../../../index.ts";

const root = document.querySelector("#app");
const framework = createAsyncFramework({ root });
const commands = createCommandBus();

const machine = createRunMachine("idle", {
  idle: { START: "planning" },
  planning: { PLAN_READY: "executing", FAIL: "failed" },
  executing: {
    WAIT_FOR_APPROVAL: "waiting_for_approval",
    COMPLETE: "completed",
    FAIL: "failed",
    CANCEL: "cancelled",
  },
  waiting_for_approval: {
    APPROVE: "executing",
    REJECT: "cancelled",
  },
  completed: { RETRY: "planning" },
  failed: { RETRY: "planning" },
  cancelled: { RETRY: "planning" },
});

const runtime = createRuntimeService({ machine, commands });

const runState = signal(machine.state);
const timeline = signal([machine.state]);
const logs = signal(["runtime initialized"]);
const lastCommand = signal("none");
const chunks = signal([]);
const waitingApproval = computed(() => runState.value === "waiting_for_approval");

const streamState = { timer: null };

function addLog(message) {
  logs.value = [...logs.value, message];
}

function startStream() {
  stopStream();
  chunks.value = [];
  const sequence = [
    "Scanning inbox...",
    "Grouping related tickets...",
    "Drafting recommendations...",
  ];

  let index = 0;
  streamState.timer = setInterval(() => {
    if (index >= sequence.length) {
      stopStream();
      runtime.requestApproval({
        runId: "run-stream-1",
        taskId: "approve-reply",
        reason: "send generated response",
      });
      return;
    }

    chunks.value = [...chunks.value, sequence[index]];
    addLog(`stream:${sequence[index]}`);
    index += 1;
  }, 350);
}

function stopStream() {
  if (streamState.timer) {
    clearInterval(streamState.timer);
    streamState.timer = null;
  }
}

runtime.subscribe((event) => {
  if (event.command?.type) {
    lastCommand.value = event.command.type;
  }

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
  addLog("execution started");
  startStream();
});

commands.on("RUN_APPROVE", async () => {
  runtime.transition({ type: "APPROVE" });
  addLog("approval accepted; finalizing");
  await sleep(300);
  runtime.transition({ type: "COMPLETE" });
  stopStream();
});

commands.on("RUN_RETRY", async () => {
  runtime.transition({ type: "RETRY" });
  await commands.send({ type: "RUN_START" });
});

commands.on("RUN_CANCEL", async () => {
  runtime.transition({ type: "CANCEL" });
  stopStream();
});

registerCommandHandlers(framework, runtime.dispatch, {
  "agentic/start": "RUN_START",
  "agentic/approve": "RUN_APPROVE",
  "agentic/retry": "RUN_RETRY",
  "agentic/cancel": "RUN_CANCEL",
});

framework.start();

effect(() => {
  root.innerHTML = `
    <section>
      <h1>Agentic UI - Common Features</h1>
      <p>State: <strong>${runState.value}</strong></p>
      <p>Last command: <strong>${lastCommand.value}</strong></p>

      <div>
        <button on:click="agentic/start">Start</button>
        <button on:click="agentic/approve" ${waitingApproval.value ? "" : "disabled"}>Approve</button>
        <button on:click="agentic/retry">Retry</button>
        <button on:click="agentic/cancel">Cancel</button>
      </div>

      <h2>Timeline</h2>
      <ol>${timeline.value.map((step) => `<li>${step}</li>`).join("")}</ol>

      <h2>Output stream</h2>
      <ul>${chunks.value.map((chunk) => `<li>${escapeHtml(chunk)}</li>`).join("")}</ul>

      <h2>Event log</h2>
      <pre>${escapeHtml(logs.value.slice(-12).join("\n"))}</pre>
    </section>
  `;
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
