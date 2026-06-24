# Router & Partials

Async includes a built-in router. Use it for URL state, link/form interception,
route params, hash routing, route partials, and route-only shells before writing
custom click, `popstate`, or `hashchange` listeners.

The router is part of L1.5. It is not a file-system router and it does not fetch
hidden pages. You register route patterns in JavaScript, choose a navigation
mode, and decide whether a route renders a partial into an `async:boundary` or
only updates `router.*` signals.

## What The Router Owns

The router coordinates five pieces:

| Piece | Purpose |
| --- | --- |
| route registry | Maps URL patterns such as `/products/:id` to route records |
| partial registry | Renders route records into HTML fragments when a mode uses partials |
| boundary | Receives rendered route HTML, usually `async:boundary="route"` |
| history mode | Writes path URLs or hash URLs and handles back/forward navigation |
| router signals | Publishes `router.path`, params, query, route metadata, pending state, and errors |

If an app already has its own view renderer, use `mode: "signals"` and bind the
view boundary to `router.*` state instead of using route partials.

## Minimal CSR Router

CSR mode starts from an empty route boundary. On startup it renders the current
route partial, then intercepts same-origin links and GET forms for later
navigation.

```html
<main async:container>
  <nav>
    <a href="/">Home</a>
    <a href="/products/sku-1">Product</a>
  </nav>

  <section async:boundary="route"></section>
</main>
```

```js
import {
  Async,
  defineRoute,
  html
} from "@async/framework";

Async.use({
  partial: {
    home() {
      return html`<h1>Home</h1>`;
    },
    "product.page"({ id }) {
      return html`
        <article>
          <h1>Product ${id}</h1>
          <a href="/">Back home</a>
        </article>
      `;
    }
  },
  route: {
    "/": defineRoute("home"),
    "/products/:id": defineRoute("product.page"),
    "*": defineRoute("notFound.page")
  }
});

Async.start({
  mode: "csr",
  root: document,
  boundary: "route"
});
```

`route(...)` remains a compatibility alias for `defineRoute(...)`.

## Direct Router Setup

Use `createRouter(...)` when you are building a custom runtime or want to pass
registries directly instead of using the app hub.

```js
import {
  createPartialRegistry,
  createRouteRegistry,
  createRouter,
  defineRoute,
  html
} from "@async/framework";

const partials = createPartialRegistry({
  home() {
    return html`<h1>Home</h1>`;
  },
  "product.page"({ id }) {
    return html`<h1>Product ${id}</h1>`;
  }
});

const routes = createRouteRegistry({
  "/": defineRoute("home"),
  "/products/:id": defineRoute("product.page")
});

const router = createRouter({
  mode: "csr",
  root: document.body,
  boundary: "route",
  routes,
  partials
}).start();

await router.navigate("/products/sku-1");
```

## Route Patterns

Routes are matched against normalized URL paths.

| Pattern | Matches | Params |
| --- | --- | --- |
| `/` | `/` | `{}` |
| `/products` | `/products` | `{}` |
| `/products/:id` | `/products/sku-1` | `{ id: "sku-1" }` |
| `/docs/:section/:page` | `/docs/runtime/router` | `{ section: "runtime", page: "router" }` |
| `*` | any unmatched path | `{}` |

Specific routes rank ahead of dynamic routes, and wildcard routes rank last.
Malformed encoded params are preserved instead of crashing navigation.

Query strings are available through `router.query`:

```txt
/products/sku-1?tab=reviews
router.path   -> "/products/sku-1"
router.params -> { id: "sku-1" }
router.query  -> { tab: "reviews" }
```

## Route Definitions

String definitions point to partial IDs:

```js
defineRoute("product.page")
```

Object definitions can carry metadata and route-only intent:

```js
defineRoute({
  render: "none",
  meta: {
    page: "dashboard",
    nav: "reports"
  }
})
```

The matched definition is published at `router.route`, so handlers and signals
can branch on route metadata without reparsing the URL.

## Router Modes

| Mode | Initial route | Later navigation | Use when |
| --- | --- | --- | --- |
| `csr` | Client renders a local partial into an empty boundary | Client renders and swaps | A no-build page owns route content on the client |
| `spa` | Existing route HTML may already be present | Client renders and swaps | SSR or static HTML should stay visible until navigation |
| `signals` | Existing HTML stays mounted | Router updates signals and history only | A shell renderer reacts to URL state itself |
| `ssr` | Server-rendered document activates | Browser navigation stays native | Navigation belongs to the server |
| `mpa` | Any document source | Browser navigation stays native | Traditional multi-page navigation |

`csr`, `spa`, and `signals` intercept same-origin links, GET forms, back/forward
events, and hash route changes. `ssr` and `mpa` leave browser navigation alone.

## Route-Only Shells

Use `mode: "signals"` when route changes should update state without rendering
partials or swapping the route boundary. This is useful for dashboards and
application shells that already derive the visible view from state.

```js
const routes = createRouteRegistry({
  "/pbi": defineRoute({ render: "none", meta: { page: "pbi" } }),
  "/fy26": defineRoute({ render: "none", meta: { page: "fy26" } })
});

const router = createRouter({
  mode: "signals",
  urlMode: "hash",
  root: document.body,
  routes
}).start();

router.loader.swap({
  type: "bind",
  boundary: "app-shell",
  render({ signals }) {
    const rendered = renderShell(signals.get("router.route"));
    return rendered.html ?? rendered;
  },
  strategy: "morph"
});
```

In `signals` mode, `partials.render(...)` is not called. Missing routes update
`router.error` and leave the DOM unchanged.

For high-frequency dashboard updates, bind or swap smaller nested boundaries
for filters, timelines, details, and modals. Reserve a full shell swap for rare
chrome-level changes.

Hash SPAs with nested `async:boundary` regions can register refresh scopes once
and batch same-tick updates:

```js
router.loader.defineRefreshPlan({
  chrome: {
    boundaries: ["app-chrome", "view-filters"],
    render({ signals }) {
      return {
        "app-chrome": { html: renderChrome(signals), strategy: "morph" },
        "view-filters": { html: renderFilters(signals), strategy: "morph" }
      };
    }
  },
  timeline: {
    boundaries: ["view-timeline"],
    render({ signals }) {
      return {
        "view-timeline": {
          html: renderTimeline(signals),
          strategy: "morph",
          attach: "rebind"
        }
      };
    }
  },
  content: {
    boundaries: ["view-detail", "view-page"],
    render({ signals }) {
      return {
        "view-detail": renderDetail(signals),
        "view-page": renderPage(signals)
      };
    }
  }
});

router.loader.refresh("timeline");
router.loader.refresh("content");
```

Use `loader.swap({ type: "many", ifChanged: true, scan: "once", updates })`
when a single event should refresh several boundaries but skip unchanged HTML
snapshots. Use `loader.swap({ type: "bind", deps: [...] })` when only specific
signal paths should trigger a bound region refresh.

## Hash Routing

Static hosts can use hash routes so every route loads through one `index.html`.

```js
Async.start({
  mode: "csr",
  urlMode: "hash",
  boundary: "route",
  root: document
});
```

With `urlMode: "hash"`, `#/docs/getting-started` is matched as
`/docs/getting-started`. Plain section anchors such as `#quickstart` remain
native page jumps and do not mutate router state.

```html
<a href="#/products/sku-1">Product route</a>
<a href="#quickstart">Section anchor</a>
```

## Link And Form Interception

Client navigation modes intercept:

- same-origin `<a href="...">` clicks;
- same-origin GET form submissions;
- `popstate` from browser back/forward;
- route hashes such as `#/products/sku-1` when `urlMode: "hash"` is enabled.

The router does not intercept:

- external links;
- links with `target` other than the current browsing context;
- downloads;
- modified clicks such as command-click or control-click;
- non-GET forms;
- plain section hashes in hash mode.

Use `router.navigate(url)` for programmatic navigation:

```js
await router.navigate("/products/sku-1");
await router.navigate("/products/sku-2", { replace: true });
await router.navigate("/products/sku-3", { history: false });
```

## Router State

Router state lives under `router.*` signals:

| Signal | Value |
| --- | --- |
| `router.url` | Full normalized route URL |
| `router.path` | Matched route pathname |
| `router.params` | Dynamic params from the route pattern |
| `router.query` | Query object derived from the URL search params |
| `router.route` | Matched route definition or `null` |
| `router.pending` | `true` while a partial-rendering navigation is in flight |
| `router.error` | Last navigation error or `null` |

Example DOM bindings:

```html
<span signal:text="router.path"></span>
<section class:loading="router.pending"></section>
```

Example handler:

```js
Async.use({
  handler: {
    "nav.next"({ router }) {
      return router.navigate("/products/sku-2");
    }
  }
});
```

## Partial Results

Route partials can return strings, `html` templates, DOM fragments, or response
envelopes.

```js
createPartialRegistry({
  "product.page": async function ({ id }) {
    const product = await this.server.products.get(id);
    return {
      html: html`<h1>${product.title}</h1>`,
      signals: {
        "product.current": product
      },
      cache: {
        browser: {
          [`product:${id}`]: product
        }
      }
    };
  }
});
```

For route partial envelopes:

- `status: 204`, a missing `html` key, and bare `null` or `undefined` partial
  results mean no route HTML replacement.
- `html: undefined` also skips replacement and emits a dev warning.
- `html: ""` intentionally clears the route boundary.
- `redirect` follows the router redirect path.
- `signals` and browser cache patches apply before the route boundary swap.

## Prefetch

`router.prefetch(url)` renders a local partial and returns its result without
mutating router state, browser history, or the DOM.

```js
const preview = await router.prefetch("/products/sku-1");
```

Prefetch can still execute partial code. Keep partial prefetch work idempotent
or move side effects behind explicit user actions.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Links reload the whole page | Confirm the router mode is `csr`, `spa`, or `signals`, and that links are same-origin without `target` or `download`. |
| The first route does not render | Confirm the route boundary exists and `boundary` matches its `async:boundary` value. |
| A route matches but nothing appears | Confirm the route points to a registered partial, or use `mode: "signals"` for route-only state. |
| Hash routes do not match | Use `#/path`, not `#path`, for router navigation. |
| Section anchors stopped working | Plain `#section` anchors should stay native in hash mode; use `#/section` only for routes. |
| Route state updates but the DOM stays unchanged | That is expected in `signals` mode; render from `router.*` signals or switch to `csr`/`spa`. |
| A partial cleared the boundary unexpectedly | Return `{ status: 204 }` or omit `html`; use `html: ""` only for an intentional clear. |

## Checklist

Before writing custom navigation code, check whether the built-in router covers
the need:

- URL params and wildcard fallback: route patterns.
- Static-host navigation: `urlMode: "hash"`.
- Client-rendered route content: `mode: "csr"` or `mode: "spa"`.
- URL-backed dashboard state: `mode: "signals"`.
- High-frequency state refreshes: nested boundaries with `swap(...)` config
  types for bound, unchanged-aware, or batched updates.
- Server-owned navigation: `mode: "ssr"` or `mode: "mpa"`.
- Route state in DOM or handlers: `router.*` signals.
