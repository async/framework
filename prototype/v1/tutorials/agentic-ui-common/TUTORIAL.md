# Tutorial 2: Agentic UI App with Common Features

This tutorial builds an agentic UI with a reusable runtime pattern.

## Features you will build

- run lifecycle state (`idle`, `planning`, `executing`, `waiting_for_approval`, `completed`, `failed`, `cancelled`)
- command bus (`RUN_START`, `RUN_APPROVE`, `RUN_RETRY`, `RUN_CANCEL`)
- transition timeline + event logs
- approval panel
- simulated output stream
- retry/cancel controls

Completed app files are in `./completed`.

## Step 1) Runtime primitives

Use:

- `createCommandBus`
- `createRunMachine`
- `createRuntimeService`
- `createCommandTransitionProjectionPattern`
- `registerCommandHandlers` (to reduce repetitive UI handler wrappers)
- `signal`, `computed`, `effect` for projection rendering with less boilerplate

These keep orchestration outside the UI.

## Step 2) Projection store

Create one projection store from CTP helper and render from `snapshot`.

## Step 3) Loader handlers

Map UI events to commands with `on:click` attributes and a declarative binding map via `registerCommandHandlers`:

- `agentic/start`
- `agentic/approve`
- `agentic/retry`
- `agentic/cancel`

## Step 4) Simulated stream

Emit incremental messages while in executing state to mimic token/task progress.

## Step 5) Run it

Serve the repo and open:

`prototype/async-framework-v1/tutorials/agentic-ui-common/completed/index.html`
