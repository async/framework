# Server And Data System

Reference file for [Async Framework](../framework.md). This file owns server
functions, explicit transport, result envelopes, request context, and
browser/server cache separation.

## Purpose

Async server behavior should be explicit and protocol-shaped. Browser code may
call server functions only through an application-provided transport, while
server runtimes may execute registered functions locally with request context
and server cache.

## Responsibilities

- Register and run server functions by stable dotted IDs.
- Provide a browser server proxy with explicit transport.
- Validate transport arguments, input, and signal values before serialization.
- Apply server-result envelopes for values and side effects.
- Keep request context isolated across overlapping async calls.
- Split browser cache from server cache.
- Serialize only browser-safe cache data.

## Public Contract

Server primitives include:

- `createServerRegistry(initialMap?)`.
- `createServerProxy({ endpoint, transport, signals, loader, router, cache })`.
- Dotted namespace calls such as `server.cart.add(...)`.
- Explicit server-result envelopes marked with `__async_server_result__: 1`.
- `createRequestContextStore()` for request-scoped server context.
- `defineCache(...)` and cache registries.

Browser server proxies require a `transport` function. There is no implicit
global fetch fallback.

## Subsystem Boundaries

- Server registries execute local functions.
- Browser proxies serialize requests and consume response envelopes.
- The handler system resolves `server.*(...)` command calls.
- Async signals may call server namespaces with the active abort signal.
- Cache registries own cache definitions and entries.
- The runtime decides which cache, request, and signal context is active.

## Protocol Contract

Server calls use explicit transport records:

- Request body includes `args`, default `input`, and selected `signals`.
- Supported transport values are JSON-safe primitives, dense arrays, and plain
  objects made from those values.
- Values that JSON would silently corrupt or drop are rejected before
  transport.
- Server results are ordinary values unless marked as Async result envelopes.
- Marked envelopes may include `value`, `signals`, `cache.browser`, `boundary`,
  `html`, `redirect`, or `error`.

Browser cache snapshots and patches are part of the public protocol. Server
cache contents are not.

## Resume Contract

Server/data resume behavior:

- Browser activation may restore browser cache from snapshots or envelopes.
- Server envelopes apply signal patches before boundary swaps and redirects.
- Async signals calling server functions receive the originating run's abort
  signal.
- Envelope effects must be applied once per invocation chain without mutating
  caller-owned result objects.
- Reusing the same envelope in a later independent invocation must apply effects
  again.

## Invariants

- Browser network behavior is opt-in through explicit transport.
- Unmarked domain objects with reserved-looking fields remain ordinary values.
- Error envelopes do not apply signal, cache, boundary, or redirect effects.
- Server cache is never serialized to the browser by default.
- Request context is isolated across overlapping calls and preserved through
  nested server fan-out.

## Failure Modes

- Missing server functions fail with a clear ID-specific error.
- Invalid server IDs fail before execution.
- Invalid transport responses fail before result application.
- Invalid JSON responses fail with server-function context.
- Unsupported transport values fail with a path to the invalid value.
- Error envelopes throw normalized errors.

## Acceptance Criteria

- A server registry can execute local functions and nested server calls with
  request context.
- A browser proxy posts JSON-safe args, input, and signals through explicit
  transport.
- Server envelopes apply values, signal patches, browser cache patches,
  boundary swaps, redirects, and errors in the documented order.
- Cache registries support definitions, TTL, `get`, `set`, `getOrSet`,
  `delete`, `clear`, snapshot, and restore.
- Browser runtime inspection exposes server IDs as descriptors, not executable
  server functions.

## Open Or Deferred Decisions

- Standard wire format for framework-managed server endpoints.
- Streaming server function responses.
- First-class validation/schema integration for server inputs.
- Cache persistence adapters beyond in-memory runtime cache.
