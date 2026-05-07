# Simplified Async Framework (Principles-Preserving)

This folder contains a minimal implementation of the existing async framework ideas:

- delegated async event loader
- exposed handler APIs for plain JavaScript integration
- local and remote handler registration
- remote registry pattern (manifest-driven)

## What is included

- `index.ts`: top-level exports
- `src/handler-registry.ts`: resolves handlers from local cache, dynamic imports, and remote providers
- `src/loader.ts`: delegated event loader (`on:<event>` attributes)
- `src/exposed.ts`: simple public API for JS apps

## At-a-glance mental model

If you want the shortest way to reason about the framework:

1. **Handlers** (`on:<event>`) translate UI events into command-like actions.
2. **Runtime/Machines** process events with explicit state transitions.
3. **Signals/Stores** project runtime state into UI.
4. **Cache Registry** shares cached values + invalidation policies across modules.

## Core API

```ts
import { createAsyncFramework } from "./index.ts";

const framework = createAsyncFramework({
  root: document.querySelector("#app")!,
});

framework.handlers.register("local/click", (ctx) => {
  console.log(ctx.event.type);
});

await framework.handlers.registerRemoteManifest("/registry.json");
framework.start();
```

## Event attribute syntax

```html
<button on:click="local/click, local/audit">Save</button>
```

- Uses a comma-separated handler chain.
- A handler can return a value; that value becomes `context.value` for the next handler.
- A handler can call `context.stop()` to stop the chain.

## Remote registry support

Two options are supported:

1. **Provider-based**
   - register a function that resolves handler keys from a backend/registry API.
2. **Manifest-based**
   - call `registerRemoteManifest(url)` where the JSON maps keys to module paths.
3. **Inline remote map/resolver**
   - call `registerRemoteHandlers(recordOrResolver)` with sync/async function handlers.

Example manifest:

```json
{
  "counter": "./remote-handlers.js"
}
```

Example inline remote handlers:

```ts
framework.handlers.registerRemoteHandlers({
  ping: ({ event }) => console.log("remote ping", event.type),
});

framework.handlers.registerRemoteHandlers(async (key) => {
  if (key === "audit") {
    return ({ value }) => ({ audited: true, previous: value });
  }
  return undefined;
});
```

For stronger typing, define handlers with your own context shape:

```ts
import { defineHandlers, type HandlerContext } from "./index.ts";

type AppContext = HandlerContext & {
  value?: { runId?: string };
};

const typed = defineHandlers<AppContext>()({
  "commands/start": async (ctx) => {
    return { runId: ctx.value?.runId ?? "new-run" };
  },
});

framework.handlers.registerMany(typed);
```

## Handler reference protocols

Handler refs now support explicit protocol prefixes:

- `remote:/path/to/handler.js` (force remote resolution first)
- `local:/path/to/handler.js` (force local resolution)
- no protocol defaults to local (for example `handlers/add-task`)

You can still chain handlers:

```html
<button on:click="handlers/validate, remote:/handlers/submit.js#onClick">Submit</button>
```

## Agentic patterns (runtime-first) + code examples

These examples show how to structure agentic workflows while keeping orchestration outside the UI layer.

### 1) Command-first flow

```ts
const commandBus = {
  handlers: new Map(),
  on(type, fn) {
    this.handlers.set(type, fn);
  },
  async send(command) {
    const handler = this.handlers.get(command.type);
    if (!handler) throw new Error(`No handler for command ${command.type}`);
    return await handler(command);
  },
};

commandBus.on("RUN_START", async (command) => {
  return await runtime.startRun(command.payload);
});
```

### 2) Run lifecycle machine (lightweight)

```ts
function createRunMachine(initial = "idle") {
  let state = initial;
  const subscribers = new Set();

  const transitions = {
    idle: { START: "planning" },
    planning: { PLAN_READY: "executing", FAIL: "failed" },
    executing: {
      NEED_APPROVAL: "waiting_for_approval",
      COMPLETE: "completed",
      FAIL: "failed",
    },
    waiting_for_approval: { APPROVE: "executing", REJECT: "cancelled" },
  };

  return {
    get state() {
      return state;
    },
    send(event) {
      const next = transitions[state]?.[event.type];
      if (!next) return state;
      const prev = state;
      state = next;
      subscribers.forEach((sub) => sub({ prev, next, event }));
      return state;
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}
```

### 3) Separation of transition logic and effects

```ts
const runMachine = createRunMachine();

async function executeRun(runId) {
  runMachine.send({ type: "START" }); // transition

  try {
    const plan = await llm.plan({ runId }); // effect
    runMachine.send({ type: "PLAN_READY" }); // transition

    for (const step of plan.steps) {
      await tools.execute(step); // effect
    }

    runMachine.send({ type: "COMPLETE" }); // transition
  } catch (error) {
    runMachine.send({ type: "FAIL" }); // transition
    throw error;
  }
}
```

### 4) Human-in-the-loop approval

```ts
const pendingApprovals = new Map();

async function waitForApproval(runId, taskId) {
  runMachine.send({ type: "NEED_APPROVAL" });

  return await new Promise((resolve, reject) => {
    pendingApprovals.set(taskId, { resolve, reject, runId });
  });
}

function approveTask(taskId) {
  pendingApprovals.get(taskId)?.resolve({ approved: true });
  runMachine.send({ type: "APPROVE" });
}

function rejectTask(taskId) {
  pendingApprovals.get(taskId)?.reject(new Error("Rejected by user"));
  runMachine.send({ type: "REJECT" });
}
```

### 5) Streaming updates into projections

```ts
const runStore = new Map();

function attachRunStream(runId) {
  const sse = new EventSource(`/runs/${runId}/stream`);

  sse.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    runStore.set(runId, payload.snapshot);
    renderProjection(runId);
  };

  sse.onerror = () => {
    sse.close();
    setTimeout(() => attachRunStream(runId), 1000);
  };
}

function renderProjection(runId) {
  const snapshot = runStore.get(runId);
  // project state into timeline/task list/output sections
  console.log("projection", snapshot);
}
```

### 6) Loader chain integration for command dispatch

```html
<button on:click="commands/start-run, telemetry/log-command">
  Start Run
</button>
```

```ts
framework.handlers.register("commands/start-run", async ({ value }) => {
  const run = await commandBus.send({
    type: "RUN_START",
    payload: { goal: "triage support inbox", previous: value },
  });
  return run;
});

framework.handlers.register("telemetry/log-command", ({ value }) => {
  console.log("command result", value);
});
```

## Examples

Most examples now use `signal`-first state updates to reduce manual render boilerplate.

- `basic-local` is the only intentionally non-JSX hello-world example.
- See `examples/README.md` for a walkthrough of each app and code structure.

### 1) Local handlers

`examples/basic-local` shows local registrations and chained handlers.

### 2) Remote registry handlers

`examples/remote-registry` shows loading handlers from a registry manifest.

### 3) Agentic app (JSX + runtime service)

`examples/agentic-app` shows a full agentic flow using:

- `createCommandBus`
- `createRunMachine`
- `createRuntimeService`
- simplified JSX renderer (`jsx`, `Fragment`, `createStore`, `mount`)
- loader handlers for `start`, `approve`, and `cancel` commands.

### 4) Agentic support triage (CTP pattern)

`examples/agentic-support-triage` uses the common CTP pattern helper for command dispatch, transition logging, and projection updates.

### 5) Agentic approval workflow (CTP pattern)

`examples/agentic-approval-workflow` uses the same CTP helper to model wait-for-approval and approve/reject transitions.

## Running examples quickly

Serve this repo with any static file server (or reuse existing project dev server), then open:

- `prototype/async-framework-v1/examples/basic-local/index.html`
- `prototype/async-framework-v1/examples/remote-registry/index.html`
- `prototype/async-framework-v1/examples/agentic-app/index.html`
- `prototype/async-framework-v1/examples/agentic-support-triage/index.html`
- `prototype/async-framework-v1/examples/agentic-approval-workflow/index.html`
- `prototype/async-framework-v1/examples/agentic-signals/index.html`
- `prototype/async-framework-v1/examples/router-machine/index.html`
- `prototype/async-framework-v1/examples/form-machine/index.html`

## Strategy docs

- `REWRITE_PROMPT.md`: implementation prompt for simplified framework rewrite
- `AGENTIC_REQUIREMENTS.md`: runtime-first/agentic architecture requirements


## Built-in agentic helper APIs

The simplified package now exports helper primitives for agentic orchestration:

- `createCommandBus()`
- `createRunMachine(initialState, transitions)`
- `createRuntimeService({ machine, commands })`

```ts
import {
  createCommandBus,
  createRunMachine,
  createRuntimeService,
} from "./index.ts";

const commands = createCommandBus();
const machine = createRunMachine("idle", {
  idle: { START: "executing" },
  executing: { WAIT_FOR_APPROVAL: "waiting_for_approval", COMPLETE: "completed" },
  waiting_for_approval: { APPROVE: "executing", REJECT: "failed" },
  completed: {},
  failed: {},
});

const runtime = createRuntimeService({ machine, commands });
```

## What is needed for `server$`-style support in this framework

To support a Qwik-like `server$` model (server functions callable from client handlers), this framework needs:

1. **Server function registry + stable IDs**
   - map server functions to IDs and expose manifests to client runtime.
2. **Client transport layer**
   - POST/RPC transport for calling server function IDs with serialized payloads.
3. **Serialization contract**
   - safe structured-clone style payload + response + error envelopes.
4. **Auth/session propagation**
   - automatic credentials/session context pass-through.
5. **Streaming server responses**
   - support partial chunks and progress events from server calls.
6. **Retry/idempotency controls**
   - retry keys, dedupe, and cancellation support for long-running actions.
7. **Server-side command/runtime bridge**
   - allow `server$` calls to dispatch into runtime service/machine transitions.
8. **Inspection and tracing**
   - per call trace IDs, command history, and transition logs shared between client/server.

For an agentic server-side path specifically, add:

- persisted run store (`runId`, state, history, checkpoints),
- approval wait queues,
- resumable stream cursors,
- tool execution sandbox and policy checks,
- run reattachment API (`GET /runs/:id`, `GET /runs/:id/stream`).


## Simplified rendering engine (JSX)

A minimal rendering engine is included in `src/rendering.ts` and exported from `index.ts`:

- `jsx/jsxs/jsxDEV`
- `Fragment`
- `createStore(initial)`
- `mount(root, view)`

This is intentionally lightweight and re-renders from a projection function; orchestration stays in runtime services.

```ts
/** @jsx jsx */
/** @jsxFrag Fragment */
import { jsx, Fragment, createStore, mount } from "./index.ts";

const state = createStore({ count: 0 });
const root = document.querySelector("#app")!;
const renderer = mount(root, () => (
  <button on:click="counter/increment">Count: {state.get().count}</button>
));

state.subscribe(() => renderer.render());
```


## Common agentic pattern in framework: CTP loop

The framework now includes a reusable **Command → Transition → Projection (CTP)** helper:

- `createCommandTransitionProjectionPattern(runtime, initialState)`

What it provides:

- a projection store with `{ state, timeline, logs, lastCommand }`
- automatic runtime event logging
- timeline/state updates on transitions
- a `run(command)` helper for dispatching commands

```ts
import { createCommandTransitionProjectionPattern } from "./index.ts";

const ctp = createCommandTransitionProjectionPattern(runtime, machine.state);
await ctp.run({ type: "TRIAGE_START" });
console.log(ctp.store.get().timeline);
```


## Current limitations / issues to be aware of

- No automated tests yet for handler resolution, chain semantics, and agentic primitives.
- The JSX renderer is intentionally minimal (full diffing/reconciliation is not implemented).
- No SSR or hydration support in this simplified package.
- No built-in persistence for long-lived runs (you must provide server-side storage).
- No built-in SSE transport helper yet (examples show raw `EventSource` pattern).


## CTP mental model for humans

Think of CTP as a runtime-centric assembly line:

1. **Command**
   - A user or system intent enters the runtime (`START_RUN`, `APPROVE`, `RETRY`, `CANCEL`).
2. **Transition**
   - The runtime machine decides whether the event is valid and moves state (`planning -> executing -> waiting_for_approval -> completed`).
3. **Projection**
   - The UI/store is updated from runtime snapshots and transition events (timeline, logs, status panels, output stream).

In short: **UI emits intent, runtime owns truth, UI renders truth**.

### Why this is easier for humans

- You can ask three deterministic debugging questions:
  1. What command came in?
  2. What transition happened?
  3. What projection changed in the UI?
- Runtime behavior is visible as event history, not hidden in component-local effects.
- Approval/retry/cancel logic sits in one workflow model instead of being scattered in many components.

### Pros vs typical React mental model

React (typical app architecture):

- strengths:
  - excellent component composition and ecosystem
  - ergonomic UI state handling for local interactions
- tradeoffs for agentic workflows:
  - orchestration often spreads across hooks/effects/context/service layers
  - long-lived run state can be fragmented across routes/components
  - transition/event history is not a default first-class abstraction

CTP/runtime-first model:

- strengths:
  - commands are first-class and auditable
  - lifecycle transitions are explicit and inspectable
  - projection makes UI replaceable (same runtime can drive different UIs)
  - naturally fits resumability/reattachment by run ID
  - easier to model human-in-the-loop pauses and approvals
- tradeoffs:
  - requires explicit state machine discipline
  - less "magical" than component-state-first flows
  - requires good runtime tooling/devtools to stay ergonomic

### Why this is especially good for agentic apps

Agentic apps are long-running and interruption-prone. CTP maps directly to those realities:

- Commands represent operator/system intent (`retry`, `approve`, `edit goal`).
- Transitions model lifecycle truth (`executing`, `waiting_for_approval`, `failed`).
- Projections keep UIs in sync across timeline views, task lists, logs, and streams.

Because CTP keeps orchestration outside render trees, it is easier to:

- reconnect to an active run after refresh/navigation,
- stream partial output and progress updates,
- replay and audit transitions,
- hand off run ownership between humans and AI safely.


## Tutorials (step-by-step + completed apps)

### 1) Simple Todo CRUD tutorial

- Instructions: `tutorials/simple-todo-crud/TUTORIAL.md`
- Completed app: `tutorials/simple-todo-crud/completed/`

### 2) Agentic UI common features tutorial

- Instructions: `tutorials/agentic-ui-common/TUTORIAL.md`
- Completed app: `tutorials/agentic-ui-common/completed/`

These tutorials are designed so humans and AI agents can follow the same runtime-first implementation flow.


## Reducing UI boilerplate for commands + handlers

A common pain point is writing many tiny handlers that only dispatch commands.
Use `registerCommandHandlers()` to map UI handler keys directly to commands.

```ts
import { registerCommandHandlers } from "./index.ts";

registerCommandHandlers(framework, ctp.run, {
  "agentic/start": "RUN_START",
  "agentic/approve": "RUN_APPROVE",
  "agentic/retry": "RUN_RETRY",
  "agentic/cancel": "RUN_CANCEL",
});
```

This removes repetitive wrapper handlers and keeps intent mapping declarative.

You can also use dynamic bindings when payload is needed:

```ts
registerCommandHandlers(framework, ctp.run, {
  "task/select": (ctx) => ({
    type: "TASK_SELECT",
    payload: { id: ctx.element.getAttribute("data-id") },
  }),
});
```


## Simpler state machine mental model (for humans)

If state machines feel hard, use this reduced model:

### Treat a run like a shipping package

A package can only be in one place at a time:

- `idle` (not started)
- `planning`
- `executing`
- `waiting_for_approval`
- `completed` / `failed` / `cancelled`

A **command** is like a scan event on the package (`START`, `APPROVE`, `RETRY`, `CANCEL`).
A **transition** is the allowed movement to the next place.

If there is no allowed movement for that command, **nothing changes**.

### 5 rules that simplify everything

1. The run has exactly **one current state**.
2. Commands do not mutate UI directly; they ask runtime to transition.
3. The machine either returns a next state or keeps current state.
4. UI only reads projection snapshot (`state`, `timeline`, `logs`).
5. Side effects (LLM/tool/API) happen around transitions, not inside rendering.

### Minimal machine template (copy/paste)

```ts
const machine = createRunMachine("idle", {
  idle: { START: "executing" },
  executing: { WAIT_FOR_APPROVAL: "waiting_for_approval", COMPLETE: "completed", FAIL: "failed" },
  waiting_for_approval: { APPROVE: "executing", REJECT: "cancelled" },
  completed: { RETRY: "executing" },
  failed: { RETRY: "executing" },
  cancelled: { RETRY: "executing" },
});
```

### Decision checklist when you are stuck

Ask only these in order:

1. What is current state?
2. What command/event happened?
3. Is that command allowed from this state?
4. If yes, what next state?
5. What should projection show now?

This turns state machines from "magic" into a tiny table lookup problem.

### Why this helps more than component-state-first thinking

With component-local state, workflow logic can spread across many files/hooks.
With a machine table, workflow logic is centralized and explicit, which is easier to read, test, and debug for long-running agentic flows.


## How signals reduce boilerplate in this framework

Signals lower UI/runtime boilerplate by replacing manual:

- `get current state`
- `set state`
- `call render()`
- `wire subscriptions`

with simple reactive primitives:

- `signal(initial)`
- `computed(() => ...)`
- `effect(() => ...)`

### Why this helps

1. **Less handler code**: handlers can just update `.value`.
2. **Less render glue**: effects/computed values recalculate automatically.
3. **Better runtime projection**: timeline counts, derived status, badges become `computed`.
4. **Cleaner CTP wiring**: transition events update signals, UI auto-projects.

### Example: without signals (manual render calls)

```ts
const state = { count: 0 };
function increment() {
  state.count += 1;
  render();
}
```

### Example: with signals

```ts
import { signal, computed, effect } from "./index.ts";

const count = signal(0);
const label = computed(() => `Count: ${count.value}`);

function increment() {
  count.value += 1;
}

effect(() => {
  document.querySelector("#counter").textContent = label.value;
});
```

### Suggested signal-first pattern for agentic apps

- `runState = signal("idle")`
- `timeline = signal<string[]>([])`
- `logs = signal<string[]>([])`
- `isAwaitingApproval = computed(() => runState.value === "waiting_for_approval")`

Then handlers and runtime transitions only update signals, and the UI projection effect stays small and centralized.


## Full diffing/reconciliation + hydration (renderer)

The simplified renderer now includes virtual-node diffing/reconciliation and hydration support:

- `jsx/jsxs/jsxDEV` now build virtual nodes
- `mount(root, view, { hydrate })` reconciles previous and next trees
- `mountReactive(root, view, { hydrate })` rerenders when used signals change
- `hydrate: true` bootstraps by converting existing DOM into a vnode baseline before patching

Example:

```ts
import { mountReactive } from "./index.ts";

mountReactive(document.querySelector("#app"), () => <App />, { hydrate: true });
```


## Signal registry for reusable/shared signals

Yes — there is a better pattern than reading current values from arbitrary web component instances.
Use a dedicated signal registry as the source-of-truth for sharable signals.

New APIs:

- `createSignalRegistry()`
- `registry.register(id, signalOrInitial)`
- `registry.ensure(id, initial)`
- `registry.get(id) / getOrThrow(id)`
- `registry.set(id, next)`
- `registry.peek(id)`
- `registry.subscribe(id, fn)`
- `registry.link(id)`

### Why this is better

- signals are addressable by stable IDs
- no component-instance coupling
- easier cross-module reuse (`handlers`, `runtime`, `views`)
- safe updates even if no view is mounted (signal updates still apply)

### Example

```ts
import { createSignalRegistry, computed } from "./index.ts";

const registry = createSignalRegistry();
const runState = registry.ensure("run.state", "idle");
const logs = registry.ensure("run.logs", [] as string[]);
const canApprove = computed(() => runState.value === "waiting_for_approval");

registry.set("run.state", "executing");
registry.subscribe("run.state", (next) => console.log("state", next));
```

This pattern gives you reusable signals with explicit ownership and avoids manual DOM/value plumbing.

## Cache registry for shared cached state + invalidation policies

For lower-boilerplate caching across query/runtime/handlers, use the cache registry APIs.

New APIs:

- `createCacheRegistry()`
- `cache.set(key, value, { ttl?, tags?, deps?, invalidateOn?, meta? })`
- `cache.get(key) / cache.entry(key)`
- `cache.getOrSet(key, fallback, options?)`
- `cache.invalidate(key)`
- `cache.invalidateByTag(tag)`
- `cache.invalidateDependents(key)` (for dependency-linked cache keys)
- `cache.delete(key) / cache.clear()`
- `cache.subscribe((event) => {})`

### Why this is useful

- one place for TTL expiration and cleanup
- dependency-based invalidation (`deps`) for derived cache data
- signal-driven invalidation via `invalidateOn` watchers
- reusable by any module (not only query machine)
- lower ceremony for "fetch once / reuse many" via `getOrSet`
- explicit semantics: `delete` removes one key; `invalidate` removes key + dependents

### Example

```ts
import { createCacheRegistry, signal } from "./index.ts";

const authToken = signal("token-v1");
const cache = createCacheRegistry();

cache.set("tickets:list", [{ id: "t1" }], {
  ttl: 60_000,
  tags: ["tickets"],
  invalidateOn: [authToken],
});

const currentUser = cache.getOrSet("auth:user", () => ({ id: "u1" }));
authToken.value = "token-v2"; // invalidates "tickets:list"
```

## Machine DSLs built on the run machine

To make machine usage easier while still interoperable with custom machines, the framework now includes lite DSL helpers built on top of `createRunMachine`:

- `createRouterMachine({ routes, initialPath?, mode? })`
- `createFormMachine({ initialValues, validate?, submit })`
- `createQueryMachine({ queryKey, queryFn, staleTime?, initialData?, cacheRegistry?, cache? })`

These expose machine state + signal projections and can interop with your own command/runtime flows because they are still backed by the same state-machine core.

### Router machine quick usage

```ts
const router = createRouterMachine({
  routes: [
    { id: "home", path: "/" },
    { id: "ticket", path: "/tickets/:id" },
  ],
});
router.start();
router.navigate("/tickets/42");
```

### Form machine quick usage

```ts
const form = createFormMachine({
  initialValues: { email: "", message: "" },
  validate(values) {
    const errors = {};
    if (!values.email.includes("@")) errors.email = "Valid email required";
    return errors;
  },
  submit(values) {
    return fetch("/api/contact", { method: "POST", body: JSON.stringify(values) });
  },
});
await form.submit();
```

### Query machine quick usage

```ts
const ticketQuery = createQueryMachine({
  queryKey: ["ticket", "42"],
  staleTime: 30_000,
  cache: {
    ttl: 5 * 60_000,
    tags: ["tickets"],
  },
  queryFn: async () => {
    const response = await fetch("/api/tickets/42");
    if (!response.ok) throw new Error("Failed to load ticket");
    return await response.json();
  },
});

await ticketQuery.fetch(); // uses cache if still fresh
await ticketQuery.refetch(); // always hits queryFn
ticketQuery.invalidate(); // invalidates cache + marks stale for next fetch
```
