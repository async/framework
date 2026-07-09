# Use Declarations And Conventions

Reference file for [Async Framework](../framework.md). This file owns
`Async.use(...)` as the declaration ingress, the convention table that routes
declaration kinds to owners, and the materialization policies that keep
registration inert until the owning capability chooses to act.

## Purpose

Async keeps the useful part of module-style registration: declarations can
arrive before the runtime or capability that consumes them is active. It does
not add string dependency injection or a broad author-facing module container.
`Async.use(...)` is the public ingress for app declarations and narrow internal
capability setup. The registry stays deliberately small: store declarations,
inspect them, record collisions, and route a declaration kind to its owner by
convention.

## Responsibilities

- Let app code register declarations before or after runtime startup.
- Keep declaration registration inert unless a convention explicitly says a
  kind materializes when it is registered.
- Let owners and capabilities decide effects, not the registry.
- Detect duplicate modules, declarations, and convention resolvers with
  configurable policy.
- Preserve queued loader and router facades without adding a `Proxy` to hot
  runtime paths.
- Give compiler-emitted L4 JSX artifacts the same declaration and convention
  path as no-build apps.

## Public Contract

Baseline app declarations still use the familiar grouped shape:

```js
Async.use({
  signal: { count: 0 },
  handler: {
    increment() {
      this.signals.update("count", (count) => count + 1);
    }
  }
});
```

Custom declaration kinds use a separate declaration group:

```js
Async.use({
  declarations: {
    view: {
      "dashboard.card": { title: "Revenue" }
    }
  }
});
```

Conventions define the route from declaration kind to owner/capability and
materialization policy:

```js
Async.use({
  conventions: {
    view: {
      owner: Async.system.for("views"),
      policy: "on-demand",
      materialize(declaration, context) {
        return context.registry.get("component", declaration.value.component);
      }
    }
  }
});
```

Duplicate behavior is configured on the app hub:

```js
Async.configure({
  duplicates: {
    modules: "warn",
    declarations: "warn",
    resolvers: "strict"
  }
});
```

The default duplicate policy is the same: modules warn, declarations warn, and
convention resolvers are strict.

## Declaration Conventions

Each convention has:

| Field | Contract |
| --- | --- |
| `kind` | Declaration kind, such as `signal`, `handler`, `route`, or a custom kind. |
| `owner` | Capability identity from `Async.system.for(id)` or an equivalent stable identity. |
| `policy` | Materialization timing: `on-register`, `on-start`, or `on-demand`. |
| `materialize` | Optional owner callback that performs effects or returns a resolved value. |

Built-in declaration kinds are conventions too:

| Kind | Owner | Policy |
| --- | --- | --- |
| `signal` | signals | `on-register` |
| `asyncSignal` | signals | `on-register` |
| `handler` | handlers | `on-register` |
| `server` | server | `on-register` |
| `partial` | partials | `on-register` |
| `route` | router | `on-register` |
| `component` | components | `on-register` |
| `flow` | flow | `on-register` |
| `cache.browser` | browser cache | `on-register` |
| `cache.server` | server cache | `on-register` |

Registration order must not decide semantics. If a declaration arrives before
its convention, the declaration stays pending. Once the convention is known,
the registry classifies the pending declarations and applies the convention's
policy.

## Materialization Policies

`on-register` materializes when a declaration is accepted. Use it for kinds
whose registration is itself the intended effect, such as built-in registry
entries.

`on-start` materializes at the explicit runtime start boundary. Use it for
capabilities that need a concrete runtime, target, scheduler, root, or cache
surface before acting.

`on-demand` materializes through a read-through resolve:

```js
const resolved = runtime.registry.resolve("view", "dashboard.card");
```

The registry finds the convention owner, calls the owner materializer, and
caches the result according to the policy. This keeps lazy owners behind a
stable registry call without requiring registration order to trigger work.

## System Identity

`Async.system.for(id)` returns a stable capability identity. The identity
prevents duplicate installs and names ownership in registry inspection. It is
not a code loader, import resolver, or author-facing module namespace.

Internal capability setup may use `Async.use({ modules: ... })`:

```js
Async.use({
  modules: {
    views: {
      owner: Async.system.for("views"),
      install({ app }) {
        app.use({
          conventions: {
            view: {
              owner: Async.system.for("views"),
              policy: "on-demand",
              materialize(declaration) {
                return declaration.value;
              }
            }
          }
        });
      }
    }
  }
});
```

Installing the same system identity more than once is idempotent. The duplicate
module policy decides whether the second install warns, is ignored, or fails.

## Queued Capabilities

Facades such as `Async.loader` and `Async.router` may queue named actions before
their concrete owner exists. The facade must expose explicit methods such as
`ready`, `scan`, `swap`, `attach`, `navigate`, and `prefetch`; it must not route
hot paths through a `Proxy`. Once the owner is active, queued actions flush in
order and later calls dispatch directly to the concrete owner.

## L4 JSX Relationship

L4 JSX author code groups behavior by meaning. The compiler may emit
declarations, conventions, and private plans at the points where runtime
ownership needs them. A JSX component, route file, or server action does not
need to become a public module container. Its output can lower into the same
`Async.use(...)`, registry, convention, and start/resolve path used by apps
on the no-compiler layers.

## Invariants

- `Async.use(...)` remains synchronous.
- Registration alone does not run owner effects unless the policy is
  `on-register`.
- The registry records declarations and collisions; owners perform effects.
- Unknown declaration kinds can be stored before their convention exists.
- Resolver duplicates are strict by default.
- `Async.start(...)` remains the explicit activation boundary.
- Loader and router facades remain method-based queues, not dynamic property
  traps.

## Failure Modes

- Strict duplicate policies throw before replacing an existing entry.
- Warning duplicate policies keep the first accepted entry.
- A declaration with no convention cannot be resolved.
- An `on-start` declaration cannot resolve before startup unless the owner has
  already materialized it for that runtime.
- Invalid materialization policies are rejected when the convention is
  registered.

## Acceptance Criteria

- Existing `Async.use({ signal, handler })` declarations still register through
  the app registry.
- A declaration registered before its convention is classified after the
  convention is added.
- Duplicate declaration policy can warn by default and fail in strict mode.
- `on-register`, `on-start`, and `on-demand` policies are testable.
- `registry.resolve(kind, id)` materializes and caches on-demand declarations.
- Installing the same `Async.system.for(id)` capability twice does not run setup
  twice.
- Loader and router queued actions continue to flush after startup.
