# Examples Guide

This folder contains runnable examples for `simplified-async-framework`.

## Important convention

- `basic-local` is the **only** intentionally non-JSX hello-world style example.
- All other examples use:
  - `createAsyncFramework`
  - delegated `on:<event>` handlers
  - signals
  - JSX rendering via `jsx` + `mountReactive`

## Examples

### 1) `basic-local` (no JSX, hello world)

Shows the smallest loader/handler setup with shared signal registry.

Files:

- `basic-local/index.html`
- `basic-local/main.js`
- `basic-local/signals.js`
- `basic-local/handlers.js`

### 2) `remote-registry`

Shows remote handler resolution using `remote:` protocol + manifest.

Files:

- `remote-registry/index.html`
- `remote-registry/main.js`
- `remote-registry/signals.js`
- `remote-registry/registry.json`
- `remote-registry/remote-handlers.js`

### 3) `agentic-app`

General runtime-first agentic app with run machine + command bus + runtime service.

### 4) `agentic-support-triage`

Agentic triage flow example using signals for runtime projection.

### 5) `agentic-approval-workflow`

Approval-centered machine transitions (`start -> waiting_for_approval -> approve/reject`).

### 6) `agentic-signals`

Small signal-focused run-state example with command handlers and JSX projection.

### 7) `router-machine`

Lite router DSL built on machine core (`createRouterMachine`) with param routes.

### 8) `form-machine`

Lite form DSL built on machine core (`createFormMachine`) with validation/submit lifecycle.

## How each app works (common structure)

1. Create framework root:

```js
const framework = createAsyncFramework({ root: document.querySelector("#app") });
```

2. Create signals/machine state.

3. Register handlers:

```js
framework.handlers.registerHandlers({
  "feature/action": () => {
    // update signals or machine
  },
});
```

4. Render with JSX + `mountReactive` (except `basic-local`):

```js
mountReactive(root, () => <App />);
```

5. Start delegated loader:

```js
framework.start();
```
