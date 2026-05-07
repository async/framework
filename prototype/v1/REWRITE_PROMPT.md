# Prompt: Rewrite `async-framework` as a simpler, principles-preserving core

Use this prompt with an AI coding assistant to produce a clean rewrite of the framework.

---

You are rewriting `async-framework` into a **simplified core** that preserves the framework’s principles while reducing complexity and API surface.

## Product intent

- This project is an **unbundled/Qwik-inspired interaction layer**, not a full SPA renderer yet.
- Focus on **loader + handlers + resumable-like event wiring**.
- Rendering, routing, and full SPA concerns will be built later.

## Core principles to preserve

1. **Attribute-driven event binding** (e.g. `on:click="..."`).
2. **Delegated event loader** at container/root level.
3. **Handler chain resolution** (multiple handlers per event, in order).
4. **Supports both sync and async handlers** seamlessly.
5. **Remote handler support** (manifest/provider/URL-based).
6. **Small JS-first API** with explicit exports for easy integration.
7. **Composable, framework-agnostic internals** (works in plain HTML/JS first).

## Rewrite goals

- Build a minimal package iteration (e.g. `prototype/async-framework-v2`).
- Keep code easy to read, strongly typed (TypeScript), and modular.
- Avoid over-engineering; prioritize clarity and deterministic behavior.
- Preserve the idea of Qwik-like lazy handler resolution without pulling in SPA rendering logic.

## Required public API

Expose these primitives from `index.ts`:

- `createHandlerRegistry(options?)`
- `createLoader(options)`
- `createAsyncFramework(options)` convenience wrapper
- Types: `HandlerContext`, `HandlerFn`, `ResolvedHandler`, `HandlerResolution`, `RemoteResolver`

### HandlerRegistry requirements

- Register local handlers:
  - `register(key, handlerOrModule)`
  - `registerMany(record)`
- Register remote resolver(s):
  - `addRemoteResolver(resolver)`
- Optional manifest helper:
  - `addManifest(url, { baseUrl? })`
- Resolve handler refs in forms:
  - `local/key`
  - `./relative/module.ts#namedExport`
  - `https://.../module.js#namedExport`
- Cache resolved modules/handlers.
- Provide deterministic export selection priority:
  1. explicit `#namedExport`
  2. `on<EventName>` convention (`onClick`, `onMouseEnter`, ...)
  3. `handler`
  4. `default`

## Loader requirements

- Delegated listener on root/container.
- Auto-discover events from `on:<event>` attributes (or accept explicit list).
- Resolve handler chain from comma-separated attribute values.
- Execute handlers sequentially and pass forward `context.value`.
- Support cancellation/bailout via `context.stop()`.
- Include `preventDefault()` and `stopPropagation()` in context.

### Sync/Async resolution (important)

Implement a **better strategy** for mixed sync/async handlers:

1. Resolve each handler reference to a callable.
2. Invoke handler and inspect result using a tiny utility:
   - `isPromiseLike(value): value is PromiseLike<unknown>`
3. Only `await` when promise-like; keep sync path fast.
4. Track per-handler metadata in debug mode:
   - resolution source (`local-cache`, `remote-resolver`, `dynamic-import`)
   - execution type (`sync` or `async`)
   - duration (ms)
5. Provide clear error boundaries:
   - include event name, handler ref, and chain index in thrown errors.

## Suggested architecture

- `src/types.ts`
- `src/utils.ts` (`isPromiseLike`, event-name normalization, parser helpers)
- `src/registry.ts`
- `src/loader.ts`
- `src/framework.ts` (convenience wiring)
- `index.ts` (exports)

## Non-goals (for this rewrite)

- No SPA renderer or VDOM.
- No router.
- No heavy compile/build transforms.
- No framework lock-in.

## Examples (must include)

Create runnable examples:

1. **basic-local**
   - local sync handlers
   - chained handlers
   - shows `context.value` flow

2. **mixed-sync-async**
   - one sync + one async handler in same chain
   - demonstrates improved sync/async detection path

3. **remote-registry**
   - registry manifest / remote resolver usage
   - lazy remote module resolution

4. **error-demo**
   - failing handler shows enriched error output

## Testing requirements

Add tests for:

- handler export selection priority
- sync vs async execution path
- chain stop behavior
- remote resolver fallback order
- manifest resolution + cache hits
- error context payload correctness

## Implementation quality bar

- Keep each file focused and short.
- Add concise comments only where behavior is non-obvious.
- Use explicit naming over clever abstractions.
- Ensure examples mirror real integration usage from plain JS/HTML.

## Deliverables

1. New simplified package folder with source, examples, and README.
2. A short migration note from old API to simplified API.
3. A design note explaining sync/async resolution decisions.
4. Passing tests for the new package.

When done, summarize:

- API shape
- execution model
- remote handler model
- tradeoffs and follow-up work for future SPA rendering integration

---

If anything is ambiguous, choose the simplest approach that preserves the principles above.
