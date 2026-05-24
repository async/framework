# Agentic Requirements for Async Framework (Runtime-First)

This document captures the target direction for evolving async-framework toward agentic development.

## Core shift

Move from page/component-first architecture to **runtime-first architecture**.

Agentic apps are centered around:

- long-lived runs
- commands
- event streams
- explicit lifecycle state
- human approvals / interruptions
- UI as projection of runtime state

## Architectural rule

```text
input/command
  -> handler
  -> runtime service
  -> lifecycle machine
  -> signal/store snapshot
  -> renderer projection
  -> streamed updates
```

## High-level patterns

1. **Command-first, not page-first**
   - `start`, `retry`, `approve`, `cancel`, `edit goal` are first-class commands.
2. **Run-centric model**
   - Route attaches to existing run; run does not belong to route.
3. **Explicit lifecycle**
   - `idle | planning | executing | waiting_for_approval | retrying | completed | failed | cancelled`.
4. **Event-driven runtime flow**
   - `command -> runtime -> transition -> state update -> projection`.
5. **Projection-based UI**
   - Timeline, task list, approval panel, stream output, logs, history.
6. **Streaming default**
   - SSE/incremental updates/reconnect/resume are normal paths.
7. **Human-in-the-loop controls**
   - pause/resume/approve/reject/retry/cancel/edit intent.
8. **Debuggable transitions**
   - command/event/state/effect/snapshot must be inspectable.

## Required framework primitives

- `command`
- `run`
- `task`
- `event`
- `machine`
- `effect`
- `subscription`
- `projection`

## Runtime APIs to add

### 1) Lightweight lifecycle machine

- explicit states + transitions
- `send(event)`
- `state`
- `snapshot`
- `subscribe(listener)`
- low boilerplate (no giant config DSL)

Example:

```ts
runMachine.send({ type: "START" });
console.log(runMachine.state);
console.log(runMachine.snapshot);
runMachine.subscribe((transition) => {
  console.log(transition);
});
```

### 2) Debuggable signal/store interface

- `get`
- `set`
- `update`
- `subscribe`
- easy inspect/log hooks

### 3) Transition/effect separation

- Transition logic: pure lifecycle updates + allowed transition checks.
- Effects: LLM/tool/DB/stream/retry logic.

### 4) Runtime service layer

Responsibilities:

- start run
- continue run
- pause/resume
- execute tool/LLM effects
- emit progress events
- request approval
- finish/fail/cancel run

### 5) Command bus

Unified intent path from keyboard/forms/buttons/programmatic calls:

```text
command -> handler -> runtime
```

### 6) Streaming and transport support

- SSE subscriptions
- event fanout
- reconnect and reattach to active runs
- resume from persisted snapshots
- project remote state into UI

### 7) Projection/render primitives

Encourage rendering from runtime snapshots:

- run snapshot
- tasks
- approval surfaces
- output stream
- event history

### 8) Fine-grained subscriptions

Targeted updates:

- single task row
- approval section
- output stream chunk
- history append

### 9) Event/transition history

- replay/debug/audit/timelines/resume support

### 10) Resumability

- reattach by run ID
- restore run state from persistence
- continue subscriptions after refresh/nav

### 11) Approval + interruption primitives

- wait for approval
- wait for correction
- wait for external completion
- cancel/retry from wait states

### 12) Runtime machine vs UI-local state split

- Runtime machine: agent lifecycle.
- UI local state: selection/focus/expansion/panel visibility.

### 13) Devtools/inspection

Must expose:

- active runs
- current state + snapshot
- last event
- pending effects
- subscriptions
- command history

## Agentic utility modules (recommended)

- `agentic/utils.ts`
  - `isPromiseLike`, `withTimeout`, `withRetry`, `serializeError`, `createRunId`
- `agentic/command-bus.ts`
  - register/dispatch command handlers
- `agentic/machine.ts`
  - minimal transition engine
- `agentic/runtime-service.ts`
  - orchestrates effects and lifecycle transitions
- `agentic/history.ts`
  - event and transition log + replay helpers
- `agentic/stream.ts`
  - SSE connections, resume cursors, reconnect handling
- `agentic/projection.ts`
  - bind runtime snapshots to views

## Anti-patterns to avoid

- component tree owns workflows
- hook/effect maze orchestration
- giant machine DSL config
- hidden reactive magic that is hard to inspect
- route-driven orchestration
- one global reactive graph for all concerns

## AI-ready concise requirements prompt

```text
Improve async-framework for agentic development.

Requirements:
- Runtime-first architecture, not component-first
- First-class commands, runs, tasks, events, effects, and projections
- Lightweight lifecycle machine with explicit states/transitions and low boilerplate
- Simple observable/signal API with get/set/update/subscribe and easy debugging
- Clear separation between transition logic and async side effects
- First-class runtime services for long-running workflows
- Built-in support for SSE/streaming/reconnect/resume
- Projection-oriented rendering for run/task/approval/output views
- Fine-grained subscriptions and targeted rerendering
- Event history / transition log support
- Human-in-the-loop primitives for approval, pause, resume, retry, cancel
- Ability to reattach UI to active runs by ID
- Strong inspection/debugging support for commands, transitions, effects, and snapshots
- Avoid heavy config DSLs and XState-like ceremony
- Keep orchestration outside the render layer
```

## One-line summary

Async-framework should evolve into a **runtime-first, command-driven, projection-based system for long-lived async workflows**.


## Server function (`server$`) support checklist

To support a Qwik-style `server$` capability, add:

- server function manifest with stable IDs
- client RPC transport to invoke server IDs
- typed serialization contract for args/result/error
- auth/session propagation and policy checks
- streaming response path for long-running functions
- cancellation + idempotency controls
- trace IDs linking client commands to server transitions
- run reattachment endpoints for long-lived workflows
