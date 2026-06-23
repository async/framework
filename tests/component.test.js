import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { Loader, component, createComponentRegistry, createHandlerRegistry, createScheduler, createServerRegistry, defineAttributeConfig, defineComponent, delay, html } from "../src/index.js";

test("component helpers create scoped signals, handlers, effects, children, and lifecycle cleanup", async () => {
  const window = new Window();
  const { document } = window;
  window.IntersectionObserver = undefined;
  document.body.innerHTML = `<main id="app"></main>`;

  const seen = [];
  let mounted = 0;
  let visible = 0;
  let cleaned = 0;
  const server = createServerRegistry({
    "toggle.next"(value) {
      return serverEnvelope({ value: !value });
    }
  });

  const Child = component(function Child() {
    return html`<small>child</small>`;
  });

  const Parent = component(function Parent() {
    const selected = this.signal("selected", false);
    const label = this.computed("label", () => (selected.value ? "selected" : "idle"));
    const toggle = this.handler("toggle", async function () {
      selected.set(await this.server.toggle.next(selected.value));
    });
    const attach = this.handler("attach", function ({ element }) {
      mounted += 1;
      element.dataset.attached = "true";
      return () => {
        cleaned += 1;
      };
    });
    const visibleHandler = this.handler("visible", function ({ element }) {
      visible += 1;
      element.dataset.visible = "true";
    });

    this.effect(() => {
      seen.push(selected.value);
    });

    return html`
      <section on:attach="${attach}" on:visible="${visibleHandler}">
        <button type="button" on:click="${toggle}" class:selected="${selected.id}">
          Toggle
        </button>
        <output signal:text="${label.id}"></output>
        ${this.render(Child)}
      </section>
    `;
  });

  const loader = Loader({ root: document, server });
  loader.mount(document.querySelector("#app"), Parent);
  await delay(0);

  assert.equal(mounted, 1);
  assert.equal(visible, 1);
  assert.equal(document.querySelector("section").dataset.attached, "true");
  assert.equal(document.querySelector("section").dataset.visible, "true");
  assert.equal(document.querySelector("small").textContent, "child");
  assert.equal(document.querySelector("output").textContent, "idle");
  assert.deepEqual(seen, [false]);

  document.querySelector("button").click();
  await delay(0);

  assert.equal(document.querySelector("button").classList.contains("selected"), true);
  assert.equal(document.querySelector("output").textContent, "selected");
  assert.deepEqual(seen, [false, true]);

  loader.destroy();
  assert.equal(cleaned, 1);
});

test("defineComponent remains as a one-time warning compatibility alias", () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    function First() {
      return html`<p>first</p>`;
    }
    function Second() {
      return html`<p>second</p>`;
    }

    assert.equal(defineComponent(First), First);
    assert.equal(defineComponent(Second), Second);
    assert.deepEqual(warnings, [
      "defineComponent(...) is deprecated. Use component(...) instead."
    ]);
  } finally {
    console.warn = originalWarn;
  }
});

function serverEnvelope(fields = {}) {
  return {
    __async_server_result__: 1,
    ...fields
  };
}

function installMockIntersectionObserver(window) {
  const observers = [];
  class MockIntersectionObserver {
    constructor(callback, options = {}) {
      this.callback = callback;
      this.options = options;
      this.observed = [];
      this.disconnected = false;
      this.disconnects = 0;
      observers.push(this);
    }

    observe(target) {
      this.observed.push(target);
    }

    disconnect() {
      if (!this.disconnected) {
        this.disconnects += 1;
      }
      this.disconnected = true;
    }

    trigger(entry) {
      if (this.disconnected) {
        return;
      }
      const target = entry.target ?? this.observed[0];
      this.callback([{
        target,
        isIntersecting: false,
        intersectionRatio: 0,
        ...entry
      }], this);
    }
  }
  window.IntersectionObserver = MockIntersectionObserver;
  return observers;
}

function targetLabel(target) {
  if (!target) {
    return "none";
  }
  if (target.matches?.("[data-page-root]")) {
    return "page";
  }
  if (target.matches?.("[data-child-root]")) {
    return "child";
  }
  if (target.matches?.("[data-grandchild-root]")) {
    return "grandchild";
  }
  return target.id || target.tagName.toLowerCase();
}

test("component this.on supports rootless fragment lifecycle fallback", async () => {
  const window = new Window();
  const { document } = window;
  window.IntersectionObserver = undefined;
  document.body.innerHTML = `<main id="app"></main>`;

  const events = [];
  const Rootless = component(function Rootless() {
    this.on("attach", (target) => {
      events.push(`attach:${target.id}`);
      return () => events.push("attach-cleanup");
    });
    this.on("mount", (target) => {
      events.push(`mount:${target.id}`);
    });
    this.on("visible", (target) => {
      events.push(`visible:${target.id}`);
    });
    this.on("destroy", () => {
      events.push("destroy");
    });

    return html`text <span>fragment</span>`;
  });

  const loader = Loader({ root: document });
  loader.mount(document.querySelector("#app"), Rootless);
  await delay(0);

  assert.deepEqual(events, ["attach:app", "mount:app", "visible:app"]);

  loader.destroy();
  assert.deepEqual(events, ["attach:app", "mount:app", "visible:app", "destroy", "attach-cleanup"]);
});

test("component identical attach callbacks both run", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;
  const scheduler = createScheduler({ strategy: "manual" });
  const events = [];
  let cleanups = 0;
  const cleanup = () => {
    cleanups += 1;
  };
  const attach = () => {
    events.push("attach");
    return cleanup;
  };

  const ReusedHook = component(function ReusedHook() {
    this.on("attach", attach);
    this.on("attach", attach);
    return html`<span>ready</span>`;
  });

  const loader = Loader({ root: document, scheduler });
  loader.mount(document.querySelector("#app"), ReusedHook);
  await scheduler.flush();

  assert.deepEqual(events, ["attach", "attach"]);
  loader.destroy();
  assert.equal(cleanups, 2);
});

test("component identical visible callbacks both run", async () => {
  const window = new Window();
  const { document } = window;
  window.IntersectionObserver = undefined;
  document.body.innerHTML = `<main id="app"></main>`;
  const scheduler = createScheduler({ strategy: "manual" });
  const events = [];
  let cleanups = 0;
  const cleanup = () => {
    cleanups += 1;
  };
  const visible = () => {
    events.push("visible");
    return cleanup;
  };

  const ReusedVisibleHook = component(function ReusedVisibleHook() {
    this.on("visible", visible);
    this.on("visible", visible);
    return html`<span>ready</span>`;
  });

  const loader = Loader({ root: document, scheduler });
  loader.mount(document.querySelector("#app"), ReusedVisibleHook);
  await scheduler.flush();

  assert.deepEqual(events, ["visible", "visible"]);
  loader.destroy();
  assert.equal(cleanups, 2);
});

test("component this.intersect observes repeated entries with normalized options", async () => {
  const window = new Window();
  const { document } = window;
  const observers = installMockIntersectionObserver(window);
  document.body.innerHTML = `<main id="app"></main>`;
  const events = [];

  const Tracker = component(function Tracker() {
    const attach = this.handler("attach", function ({ element }) {
      return this.intersect(element, {
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1]
      }, (event) => {
        events.push({
          element: event.element.id,
          isIntersecting: event.isIntersecting,
          intersectionRatio: event.intersectionRatio,
          unsupported: event.unsupported
        });
      });
    });
    return html`<section id="tracked" on:attach="${attach}">Tracked</section>`;
  });

  const loader = Loader({ root: document });
  loader.mount(document.querySelector("#app"), Tracker);
  await delay(0);

  const section = document.querySelector("#tracked");
  assert.equal(observers.length, 1);
  assert.equal(observers[0].observed[0], section);
  assert.equal(observers[0].options.root, null);
  assert.equal(observers[0].options.rootMargin, "-20% 0px -55% 0px");
  assert.deepEqual(observers[0].options.threshold, [0, 0.25, 0.5, 0.75, 1]);

  observers[0].trigger({ target: section, isIntersecting: true, intersectionRatio: 0.5 });
  await delay(0);
  observers[0].trigger({ target: section, isIntersecting: false, intersectionRatio: 0 });
  await delay(0);

  assert.deepEqual(events, [
    { element: "tracked", isIntersecting: true, intersectionRatio: 0.5, unsupported: false },
    { element: "tracked", isIntersecting: false, intersectionRatio: 0, unsupported: false }
  ]);

  loader.destroy();
  assert.equal(observers[0].disconnects, 1);
});

test("component this.intersect cancels queued callbacks on destroy", async () => {
  const window = new Window();
  const { document } = window;
  const observers = installMockIntersectionObserver(window);
  document.body.innerHTML = `<main id="app"></main>`;
  const scheduler = createScheduler({ strategy: "manual" });
  const events = [];

  const Tracker = component(function Tracker() {
    const attach = this.handler("attach", function ({ element }) {
      this.intersect(element, (event) => {
        events.push(event.intersectionRatio);
      });
    });
    return html`<section id="tracked" on:attach="${attach}">Tracked</section>`;
  });

  const loader = Loader({ root: document, scheduler });
  loader.mount(document.querySelector("#app"), Tracker);
  await scheduler.flush();

  observers[0].trigger({ target: document.querySelector("#tracked"), isIntersecting: true, intersectionRatio: 1 });
  loader.destroy();
  await scheduler.flush();

  assert.deepEqual(events, []);
  assert.equal(observers[0].disconnects, 1);
});

test("component this.intersect fallback reports unsupported once", async () => {
  const window = new Window();
  const { document } = window;
  window.IntersectionObserver = undefined;
  document.body.innerHTML = `<main id="app"></main>`;
  const scheduler = createScheduler({ strategy: "manual" });
  const events = [];

  const Tracker = component(function Tracker() {
    const attach = this.handler("attach", function ({ element }) {
      this.intersect(element, (event) => {
        events.push({
          isIntersecting: event.isIntersecting,
          intersectionRatio: event.intersectionRatio,
          unsupported: event.unsupported,
          observer: event.observer
        });
      });
    });
    return html`<section on:attach="${attach}">Tracked</section>`;
  });

  const loader = Loader({ root: document, scheduler });
  loader.mount(document.querySelector("#app"), Tracker);
  await scheduler.flush();

  assert.deepEqual(events, [{
    isIntersecting: true,
    intersectionRatio: 1,
    unsupported: true,
    observer: null
  }]);

  loader.destroy();
});

test("component this.on(\"intersect\") observes the mounted component scope", async () => {
  const window = new Window();
  const { document } = window;
  const observers = installMockIntersectionObserver(window);
  document.body.innerHTML = `<main id="app"></main>`;
  const events = [];

  const Card = component(function Card() {
    this.on("intersect", { threshold: 0.5 }, (event) => {
      events.push(event.isIntersecting);
    });
    return html`<article id="card">Card</article>`;
  });

  const loader = Loader({ root: document });
  const app = document.querySelector("#app");
  loader.mount(app, Card);
  await delay(0);

  assert.equal(observers.length, 1);
  assert.equal(observers[0].observed[0], app);
  assert.equal(observers[0].options.threshold, 0.5);

  observers[0].trigger({ target: app, isIntersecting: true, intersectionRatio: 0.75 });
  await delay(0);

  assert.deepEqual(events, [true]);
  loader.destroy();
});

test("component returned intersection cleanup disconnects when boundary children swap", async () => {
  const window = new Window();
  const { document } = window;
  const observers = installMockIntersectionObserver(window);
  document.body.innerHTML = `<section async:boundary="route"></section>`;

  const Tracker = component(function Tracker() {
    const attach = this.handler("attach", function ({ element }) {
      return this.intersect(element, () => {});
    });
    return html`<article id="tracked" on:attach="${attach}">Tracked</article>`;
  });

  const loader = Loader({ root: document });
  loader.mount(document.querySelector("[async\\:boundary='route']"), Tracker);
  await delay(0);

  assert.equal(observers.length, 1);
  assert.equal(observers[0].disconnects, 0);

  loader.swap("route", `<p id="next-route">Next</p>`);

  assert.equal(observers[0].disconnects, 1);
  assert.equal(document.querySelector("#next-route").textContent, "Next");
  loader.destroy();
});

test("component visible hook remains one-shot with IntersectionObserver", async () => {
  const window = new Window();
  const { document } = window;
  const observers = installMockIntersectionObserver(window);
  document.body.innerHTML = `<main id="app"></main>`;
  const events = [];

  const Visible = component(function Visible() {
    this.onVisible(() => {
      events.push("visible");
    });
    return html`<span>visible</span>`;
  });

  const loader = Loader({ root: document });
  const app = document.querySelector("#app");
  loader.mount(app, Visible);
  await delay(0);

  observers[0].trigger({ target: app, isIntersecting: false, intersectionRatio: 0 });
  await delay(0);
  observers[0].trigger({ target: app, isIntersecting: true, intersectionRatio: 1 });
  await delay(0);
  observers[0].trigger({ target: app, isIntersecting: true, intersectionRatio: 1 });
  await delay(0);

  assert.deepEqual(events, ["visible"]);
  assert.equal(observers[0].disconnects, 1);
  loader.destroy();
});

test("declarative on:intersect runs continuously with options and visible compatibility", async () => {
  const window = new Window();
  const { document } = window;
  const observers = installMockIntersectionObserver(window);
  document.body.innerHTML = `
    <main>
      <section
        id="tracked"
        on:visible="visible"
        on:intersect="track"
        intersect:threshold="0,0.5,1"
        intersect:root-margin="-20% 0px -55% 0px"
      >Tracked</section>
    </main>
  `;
  const visibleEvents = [];
  const intersectionEvents = [];
  const handlers = createHandlerRegistry({
    visible({ element }) {
      visibleEvents.push(element.id);
    },
    track(event) {
      intersectionEvents.push({
        element: event.element.id,
        ratio: event.intersectionRatio,
        intersecting: event.isIntersecting,
        unsupported: event.unsupported,
        entries: event.entries.length
      });
    }
  });

  const loader = Loader({ root: document, handlers }).start();
  await delay(0);

  const section = document.querySelector("#tracked");
  assert.equal(observers.length, 2);
  assert.equal(observers[0].observed[0], section);
  assert.equal(observers[1].observed[0], section);
  assert.deepEqual(observers[1].options.threshold, [0, 0.5, 1]);
  assert.equal(observers[1].options.rootMargin, "-20% 0px -55% 0px");

  observers[0].trigger({ target: section, isIntersecting: true, intersectionRatio: 1 });
  await delay(0);
  observers[0].trigger({ target: section, isIntersecting: true, intersectionRatio: 1 });
  await delay(0);
  observers[1].trigger({ target: section, isIntersecting: true, intersectionRatio: 0.5 });
  await delay(0);
  observers[1].trigger({ target: section, isIntersecting: false, intersectionRatio: 0 });
  await delay(0);
  loader.scan(document.body);
  await delay(0);

  assert.deepEqual(visibleEvents, ["tracked"]);
  assert.deepEqual(intersectionEvents, [
    { element: "tracked", ratio: 0.5, intersecting: true, unsupported: false, entries: 1 },
    { element: "tracked", ratio: 0, intersecting: false, unsupported: false, entries: 1 }
  ]);
  assert.equal(observers.length, 2);
  loader.destroy();
});

test("declarative on:intersect supports custom intersect attribute prefixes", async () => {
  const window = new Window();
  const { document } = window;
  const observers = installMockIntersectionObserver(window);
  document.body.innerHTML = `
    <main>
      <section
        id="tracked"
        data-on-intersect="track"
        data-intersect-threshold="0.25"
        data-intersect-once="true"
      >Tracked</section>
    </main>
  `;
  const events = [];
  const attributes = defineAttributeConfig({
    on: "data-on-",
    intersect: "data-intersect-"
  });
  const handlers = createHandlerRegistry({
    track(event) {
      events.push(event.intersectionRatio);
    }
  });

  const loader = Loader({ root: document, attributes, handlers }).start();
  await delay(0);

  const section = document.querySelector("#tracked");
  assert.equal(observers.length, 1);
  assert.equal(observers[0].options.threshold, 0.25);

  observers[0].trigger({ target: section, isIntersecting: true, intersectionRatio: 0.25 });
  await delay(0);
  observers[0].trigger({ target: section, isIntersecting: true, intersectionRatio: 1 });
  await delay(0);

  assert.deepEqual(events, [0.25]);
  assert.equal(observers[0].disconnects, 1);
  loader.destroy();
});

test("component child render attach hooks do not dedupe each other", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;
  const scheduler = createScheduler({ strategy: "manual" });
  const events = [];

  const Child = component(function Child() {
    this.onMount(() => {
      events.push("child");
    });
    return html`<span>child</span>`;
  });

  const Parent = component(function Parent() {
    return html`${this.render(Child)}${this.render(Child)}`;
  });

  const loader = Loader({ root: document, scheduler });
  loader.mount(document.querySelector("#app"), Parent);
  await scheduler.flush();

  assert.deepEqual(events, ["child", "child"]);
  loader.destroy();
});

test("nested component onMount targets the child render root", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;
  const scheduler = createScheduler({ strategy: "manual" });

  let mountedTarget;
  const Child = component(function Child() {
    this.onMount((target) => {
      mountedTarget = target;
      target.classList.add("child-mounted-on");
    });
    return html`<div data-child-root>child</div>`;
  });

  const Parent = component(function Parent() {
    return html`
      <section data-parent-root>
        ${this.render(Child)}
      </section>
    `;
  });

  const loader = Loader({ root: document, scheduler });
  try {
    const app = document.querySelector("#app");
    loader.mount(app, Parent);
    await scheduler.flush();

    const childRoot = document.querySelector("[data-child-root]");
    assert.equal(targetLabel(mountedTarget), "child");
    assert.equal(childRoot.classList.contains("child-mounted-on"), true);
    assert.equal(app.classList.contains("child-mounted-on"), false);
  } finally {
    loader.destroy();
  }
});

test("deeply nested render lifecycle hooks resolve each component root", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;
  const scheduler = createScheduler({ strategy: "manual" });
  const events = [];

  const Grandchild = component(function Grandchild() {
    this.onMount((target) => {
      events.push(targetLabel(target));
    });
    return html`<em data-grandchild-root>grandchild</em>`;
  });

  const Child = component(function Child() {
    this.onMount((target) => {
      events.push(targetLabel(target));
    });
    return html`
      <section data-child-root>
        ${this.render(Grandchild)}
      </section>
    `;
  });

  const Page = component(function Page() {
    this.onMount((target) => {
      events.push(targetLabel(target));
    });
    return html`
      <article data-page-root>
        ${this.render(Child)}
      </article>
    `;
  });

  const App = component(function App() {
    return html`<div data-app-root>${this.render(Page)}</div>`;
  });

  const loader = Loader({ root: document, scheduler });
  try {
    loader.mount(document.querySelector("#app"), App);
    await scheduler.flush();

    assert.deepEqual(events, ["page", "child", "grandchild"]);
  } finally {
    loader.destroy();
  }
});

test("nested visible and intersect hooks observe the child render root", async () => {
  const window = new Window();
  const { document } = window;
  const observers = installMockIntersectionObserver(window);
  document.body.innerHTML = `<main id="app"></main>`;
  const visibleTargets = [];
  const intersectTargets = [];

  const Child = component(function Child() {
    this.onVisible((target) => {
      visibleTargets.push(target);
    });
    this.on("intersect", { threshold: 0.5 }, (event) => {
      intersectTargets.push(event.target);
    });
    return html`<section data-child-root>child</section>`;
  });

  const Parent = component(function Parent() {
    return html`<article data-parent-root>${this.render(Child)}</article>`;
  });

  const loader = Loader({ root: document });
  try {
    loader.mount(document.querySelector("#app"), Parent);
    await delay(0);

    const childRoot = document.querySelector("[data-child-root]");
    assert.equal(observers.length, 2);
    assert.deepEqual(observers.map((observer) => targetLabel(observer.observed[0])), ["child", "child"]);

    observers[0].trigger({ target: childRoot, isIntersecting: true, intersectionRatio: 1 });
    observers[1].trigger({ target: childRoot, isIntersecting: true, intersectionRatio: 0.75 });
    await delay(0);

    assert.deepEqual(visibleTargets.map(targetLabel), ["child"]);
    assert.deepEqual(intersectTargets.map(targetLabel), ["child"]);
  } finally {
    loader.destroy();
  }
});

test("nested rootless and multi-root lifecycle hooks target the containing element", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;
  const scheduler = createScheduler({ strategy: "manual" });
  const events = [];

  const Rootless = component(function Rootless() {
    this.onMount((target) => {
      events.push(`rootless:${target.id}`);
    });
    return html`label <span data-rootless>rootless</span>`;
  });

  const MultiRoot = component(function MultiRoot() {
    this.onMount((target) => {
      events.push(`multi:${target.id}`);
    });
    return html`<span data-first>first</span><span data-second>second</span>`;
  });

  const Parent = component(function Parent() {
    return html`
      <section id="container">
        ${this.render(Rootless)}
        ${this.render(MultiRoot)}
      </section>
    `;
  });

  const loader = Loader({ root: document, scheduler });
  try {
    loader.mount(document.querySelector("#app"), Parent);
    await scheduler.flush();

    assert.deepEqual(events, ["rootless:container", "multi:container"]);
  } finally {
    loader.destroy();
  }
});

test("nested onMount scroll wrappers do not mutate ancestor async boundaries", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;
  const scheduler = createScheduler({ strategy: "manual" });

  const HorizontalScrollChrome = component(function HorizontalScrollChrome({ children }) {
    this.onMount((target) => {
      const scroller = target?.lastElementChild;
      const host = scroller?.parentElement;
      const startFade = host?.children[0];
      startFade?.classList.add("hidden", "opacity-0");
    });

    return html`
      <div data-scroll-chrome>
        <span data-scroll-fade="start"></span>
        <div data-horizontal-scroll>${children}</div>
      </div>
    `;
  });

  const App = component(function App() {
    return html`
      <div async:boundary="app-shell">
        <main>
          ${this.render(HorizontalScrollChrome, {}, html`<p>rows</p>`)}
        </main>
      </div>
    `;
  });

  const loader = Loader({ root: document, scheduler });
  try {
    loader.mount(document.querySelector("#app"), App);
    await scheduler.flush();

    const appShell = document.querySelector("[async\\:boundary='app-shell']");
    const startFade = document.querySelector("[data-scroll-fade='start']");
    assert.equal(appShell.classList.contains("hidden"), false);
    assert.equal(appShell.classList.contains("opacity-0"), false);
    assert.equal(startFade.classList.contains("hidden"), true);
    assert.equal(startFade.classList.contains("opacity-0"), true);
  } finally {
    loader.destroy();
  }
});

test("component render passes static children as a scoped fragment", () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;

  const Card = component(function Card({ title, children }) {
    return html`
      <article>
        <h2>${title}</h2>
        ${children}
      </article>
    `;
  });

  const App = component(function App() {
    return html`${this.render(Card, { title: "Status" }, html`<p>Ready</p>`)}`;
  });

  const loader = Loader({ root: document });
  loader.mount(document.querySelector("#app"), App);

  assert.equal(document.querySelector("h2").textContent, "Status");
  assert.equal(document.querySelector("p").textContent, "Ready");
  loader.destroy();
});

test("component children factories are lazy and can render nested components", () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;

  let evaluated = 0;
  const Badge = component(function Badge({ label }) {
    return html`<strong>${label}</strong>`;
  });
  const Card = component(function Card({ children }) {
    return html`<article>${children}</article>`;
  });
  const EmptyCard = component(function EmptyCard() {
    return html`<article>empty</article>`;
  });
  const App = component(function App() {
    const lazyChildren = function children() {
      evaluated += 1;
      return html`<p>${this.render(Badge, { label: "Live" })}</p>`;
    };
    return html`
      ${this.render(EmptyCard, {}, lazyChildren)}
      ${this.render(Card, {}, lazyChildren)}
    `;
  });

  const loader = Loader({ root: document });
  loader.mount(document.querySelector("#app"), App);

  assert.equal(evaluated, 1);
  assert.equal(document.querySelector("strong").textContent, "Live");
  loader.destroy();
});

test("component children escape strings by default", () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;

  const Card = component(function Card({ children }) {
    return html`<article>${children}</article>`;
  });
  const App = component(function App() {
    return html`${this.render(Card, {}, `<script>alert("x")</script>`)}`;
  });

  const loader = Loader({ root: document });
  loader.mount(document.querySelector("#app"), App);

  assert.equal(document.querySelector("article").textContent, `<script>alert("x")</script>`);
  assert.equal(document.querySelector("script"), null);
  loader.destroy();
});

test("component render rejects duplicate children sources and double consumption", () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;

  const SingleConsumeCard = component(function SingleConsumeCard({ children }) {
    return html`<article>${children}</article>`;
  });
  const DuplicateSources = component(function DuplicateSources() {
    return html`${this.render(SingleConsumeCard, { children: html`<p>prop</p>` }, html`<p>argument</p>`)}`;
  });
  const DoubleConsume = component(function DoubleConsume() {
    return html`${this.render(DoubleConsumeCard, {}, html`<p>once</p>`)}`;
  });
  const DoubleConsumeCard = component(function DoubleConsumeCard({ children }) {
    return html`<article>${children}${children}</article>`;
  });

  const loader = Loader({ root: document });
  assert.throws(
    () => loader.mount(document.querySelector("#app"), DuplicateSources),
    /cannot receive both props\.children and a children argument/
  );
  assert.throws(
    () => loader.mount(document.querySelector("#app"), DoubleConsume),
    /children fragments can only be consumed once/
  );
  loader.destroy();
});

test("component children cleanup releases nested scoped handlers and signals", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <main>
      <section async:boundary="route">
        <div id="slot"></div>
      </section>
    </main>
  `;

  let clicks = 0;
  let handlerId;
  let signalId;
  const Action = component(function Action() {
    const selected = this.signal(false);
    signalId = selected.id;
    handlerId = this.handler(function () {
      clicks += 1;
      selected.set(true);
    });
    return html`<button id="action" type="button" on:click="${handlerId}" class:selected="${selected}">Action</button>`;
  });
  const Card = component(function Card({ children }) {
    return html`<article>${children}</article>`;
  });
  const App = component(function App() {
    return html`${this.render(Card, {}, function children() {
      return html`${this.render(Action)}`;
    })}`;
  });

  const loader = Loader({ root: document.body }).start();
  loader.mount(document.querySelector("#slot"), App);
  await delay(0);

  const action = document.querySelector("#action");
  assert.equal(typeof loader.handlers.resolve(handlerId), "function");
  assert.equal(loader.signals.has(signalId), true);

  action.click();
  await delay(0);
  assert.equal(clicks, 1);
  assert.equal(action.classList.contains("selected"), true);

  loader.swap("route", `<p id="next-route">Next</p>`);

  assert.equal(loader.handlers.resolve(handlerId), undefined);
  assert.equal(loader.signals.has(signalId), false);
  assert.equal(document.querySelector("#next-route").textContent, "Next");

  action.click();
  await delay(0);
  assert.equal(clicks, 1);
  loader.destroy();
});

test("Loader mounts registered components from async:component attributes", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main async:component="Greeting"></main>`;

  let sawComponents = false;
  const Child = component(function Child() {
    return html`<span>Child</span>`;
  });
  const Greeting = component(function Greeting() {
    assert.equal(this.components.resolve("Child"), Child);
    sawComponents = true;
    return html`<h1>Hello</h1>`;
  });
  const components = createComponentRegistry({
    Child,
    Greeting
  });

  const loader = Loader({ root: document, components }).start();
  await delay(0);

  assert.equal(document.querySelector("h1").textContent, "Hello");
  assert.equal(sawComponents, true);
  loader.destroy();
});

test("component slots mount child components into attached outlets and update from signal props", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;

  const Row = component(function Row({ label }) {
    return html`<li>${label}</li>`;
  });

  const List = component(function List({ rows, RowComponent }) {
    return html`${rows.map((label) => this.render(RowComponent, { label }))}`;
  });

  const App = component(function App() {
    const rows = this.signal("rows", []);
    const rowsSlot = this.slot(List, () => ({
      rows: rows.value,
      RowComponent: Row
    }));

    return html`
      <button
        id="add"
        type="button"
        on:click="${this.handler(() => {
          rows.set([...rows.value, `row-${rows.value.length + 1}`]);
        })}"
      >Add</button>
      <ul id="rows" on:attach="${rowsSlot.attach}"></ul>
    `;
  });

  const loader = Loader({ root: document });
  loader.mount(document.querySelector("#app"), App);
  await delay(0);

  assert.equal(document.querySelectorAll("li").length, 0);
  document.querySelector("#add").click();
  await delay(0);

  assert.deepEqual([...document.querySelectorAll("li")].map((node) => node.textContent), ["row-1"]);
  loader.destroy();
});

test("component returning a Promise throws a clear unsupported error", () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;

  const AsyncComponent = component(async function AsyncComponent() {
    return html`<span>async</span>`;
  });

  const loader = Loader({ root: document });

  assert.throws(
    () => loader.mount(document.querySelector("#app"), AsyncComponent),
    /Component "AsyncComponent" returned a Promise\. Async components are not supported/
  );

  loader.destroy();
});

test("lazy component descriptors mounted through Loader throw a clear unsupported error", () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;
  const components = createComponentRegistry({
    ProductCard: { url: "ProductCard.js" }
  }, {
    importModule() {
      return {
        ProductCard: component(function ProductCard() {
          return html`<span>Product</span>`;
        })
      };
    }
  });
  const loader = Loader({ root: document });

  assert.throws(
    () => loader.mount(document.querySelector("#app"), components.resolve("ProductCard")),
    /Component "LazyComponent" returned a Promise\. Async components are not supported/
  );

  loader.destroy();
});

test("lazy component descriptors used through this.render throw a clear unsupported error", () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;
  const components = createComponentRegistry({
    ProductCard: { url: "ProductCard.js" }
  }, {
    importModule() {
      return {
        ProductCard: component(function ProductCard() {
          return html`<span>Product</span>`;
        })
      };
    }
  });
  const LazyProductCard = components.resolve("ProductCard");
  const Parent = component(function Parent() {
    return html`${this.render(LazyProductCard)}`;
  });
  const loader = Loader({ root: document });

  assert.throws(
    () => loader.mount(document.querySelector("#app"), Parent),
    /Component "LazyComponent" returned a Promise\. Async components are not supported/
  );

  loader.destroy();
});

test("component visible hook does not run after parent is destroyed", async () => {
  const window = new Window();
  const { document } = window;
  window.IntersectionObserver = undefined;
  document.body.innerHTML = `<main id="app"></main>`;
  const scheduler = createScheduler({ strategy: "manual" });
  const events = [];

  const Visible = component(function Visible() {
    this.on("visible", () => {
      events.push("visible");
    });
    return html`<span>visible</span>`;
  });

  const loader = Loader({ root: document, scheduler });
  loader.mount(document.querySelector("#app"), Visible);
  loader.destroy();
  await scheduler.flush();

  assert.deepEqual(events, []);
});

test("component templates support inline handlers, signal class values, and signal value attributes", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;

  const ProductCard = component(function ProductCard(props) {
    const selected = this.signal(false);
    const tone = this.signal("primary");
    const productId = this.signal("productId", props.id);

    return html`
      <article
        id="card"
        class:selected="${selected}"
        signal:class="${["card", selected, tone, { featured: selected }]}"
      >
        <h2>${props.title}</h2>
        <input id="value-input" value="${productId}">
        <input id="signal-value-input" signal:value="${productId}">
        <button
          id="select"
          type="button"
          on:click="${this.handler(function () {
            selected.set(true);
            tone.set("accent");
            productId.set("sku-2");
          })}"
        >
          Select
        </button>
      </article>
    `;
  });

  const loader = Loader({ root: document });
  loader.mount(document.querySelector("#app"), ProductCard, {
    id: "sku-1",
    title: "Keyboard"
  });
  await delay(0);

  const card = document.querySelector("#card");
  const valueInput = document.querySelector("#value-input");
  const signalValueInput = document.querySelector("#signal-value-input");

  assert.equal(card.classList.contains("card"), true);
  assert.equal(card.classList.contains("primary"), true);
  assert.equal(card.classList.contains("selected"), false);
  assert.equal(card.classList.contains("featured"), false);
  assert.equal(valueInput.value, "sku-1");
  assert.equal(signalValueInput.value, "sku-1");

  document.querySelector("#select").click();
  await delay(0);

  assert.equal(card.classList.contains("selected"), true);
  assert.equal(card.classList.contains("featured"), true);
  assert.equal(card.classList.contains("primary"), false);
  assert.equal(card.classList.contains("accent"), true);
  assert.equal(valueInput.value, "sku-2");
  assert.equal(signalValueInput.value, "sku-2");

  valueInput.value = "sku-3";
  valueInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  await delay(0);

  assert.equal(signalValueInput.value, "sku-3");

  loader.destroy();
});

test("component form input events bubble to scoped handlers", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;

  const OperationForm = component(function OperationForm() {
    const command = this.signal("command", "model=qwen3:8b");
    const updateCommand = this.handler(function ({ event }) {
      const form = event.currentTarget;
      command.set(`model=${form.elements.model.value}`);
    });

    return html`
      <form id="operation-form" on:input="${updateCommand}" on:change="${updateCommand}">
        <label>
          <span>model</span>
          <input name="model" type="text" value="qwen3:8b">
        </label>
      </form>
      <code id="operation-command" signal:text="${command}"></code>
    `;
  });

  const loader = Loader({ root: document });
  loader.mount(document.querySelector("#app"), OperationForm);
  await delay(0);

  const input = document.querySelector("input[name='model']");
  input.value = "llama3.1:8b";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  await delay(0);

  assert.equal(document.querySelector("#operation-command").textContent, "model=llama3.1:8b");

  loader.destroy();
});

test("component templates support inline signal refs for text, attributes, and properties", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;

  const FormControls = component(function FormControls() {
    const title = this.signal("Keyboard");
    const disabled = this.signal(true);
    const checked = this.signal(false);
    const name = this.signal("sku-1");

    return html`
      <section>
        <h1 signal:text="${title}"></h1>
        <button id="save" signal:attr:disabled="${disabled}">Save</button>
        <input id="checked" type="checkbox" signal:prop:checked="${checked}">
        <input id="name" signal:prop:value="${name}">
        <button
          id="change"
          type="button"
          on:click="${this.handler(function () {
            title.set("Headphones");
            disabled.set(false);
            checked.set(true);
            name.set("sku-2");
          })}"
        >
          Change
        </button>
      </section>
    `;
  });

  const loader = Loader({ root: document });
  loader.mount(document.querySelector("#app"), FormControls);
  await delay(0);

  assert.equal(document.querySelector("h1").textContent, "Keyboard");
  assert.equal(document.querySelector("#save").hasAttribute("disabled"), true);
  assert.equal(document.querySelector("#save").disabled, true);
  assert.equal(document.querySelector("#checked").checked, false);
  assert.equal(document.querySelector("#name").value, "sku-1");

  document.querySelector("#change").click();
  await delay(0);

  assert.equal(document.querySelector("h1").textContent, "Headphones");
  assert.equal(document.querySelector("#save").hasAttribute("disabled"), false);
  assert.equal(document.querySelector("#save").disabled, false);
  assert.equal(document.querySelector("#checked").checked, true);
  assert.equal(document.querySelector("#name").value, "sku-2");

  loader.destroy();
});

test("component scoped handlers and signals clean up when a mounted fragment is swapped out", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <main>
      <section async:boundary="route">
        <div id="slot"></div>
      </section>
    </main>
  `;

  let clicks = 0;
  let destroyed = 0;
  let handlerId;
  let signalId;

  const Card = component(function Card() {
    const selected = this.signal(false);
    signalId = selected.id;
    handlerId = this.handler(function () {
      clicks += 1;
      selected.set(true);
    });
    this.on("destroy", () => {
      destroyed += 1;
    });

    return html`
      <button
        id="old-select"
        type="button"
        on:click="${handlerId}"
        signal:class="${["card", { selected }]}"
      >
        Select
      </button>
    `;
  });

  const loader = Loader({ root: document.body }).start();
  loader.mount(document.querySelector("#slot"), Card);
  await delay(0);

  const oldButton = document.querySelector("#old-select");
  assert.equal(typeof loader.handlers.resolve(handlerId), "function");
  assert.equal(loader.signals.has(signalId), true);

  oldButton.click();
  await delay(0);
  assert.equal(clicks, 1);
  assert.equal(oldButton.classList.contains("selected"), true);

  loader.swap("route", `<p id="next-route">Next</p>`);

  assert.equal(destroyed, 1);
  assert.equal(loader.handlers.resolve(handlerId), undefined);
  assert.equal(loader.signals.has(signalId), false);
  assert.equal(document.querySelector("#next-route").textContent, "Next");

  oldButton.click();
  await delay(0);
  assert.equal(clicks, 1);

  loader.destroy();
});

test("component this.suspense emits async boundary templates without owning a wrapper", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;

  const server = createServerRegistry({
    "products.get"() {
      return { title: "Keyboard" };
    }
  });

  const Product = component(function Product() {
    const product = this.asyncSignal("product", async function () {
      await delay(5, this.abort);
      return this.server.products.get("sku-1");
    });

    return html`
      <article id="product" async:boundary="${product.id}">
        ${this.suspense(product, {
          loading() {
            return html`<p class="loading">Loading...</p>`;
          },
          ready(product) {
            return html`<h1 signal:text="${product.id}.title"></h1>`;
          },
          error(product) {
            return html`<p class="error" signal:text="${product.id}.$error.message"></p>`;
          }
        })}
      </article>
    `;
  });

  const loader = Loader({ root: document, server });
  loader.mount(document.querySelector("#app"), Product);

  assert.equal(document.querySelector("#product").tagName, "ARTICLE");
  assert.equal(document.querySelector(".loading").textContent, "Loading...");
  assert.equal(document.querySelector("#product > section"), null);

  for (let attempt = 0; attempt < 10 && !document.querySelector("h1"); attempt += 1) {
    await delay(5);
  }

  assert.equal(document.querySelector("h1").textContent, "Keyboard");
  assert.equal(document.querySelector("#product").tagName, "ARTICLE");

  loader.destroy();
});

test("component this.suspense supports shorthand ready views and configured async attributes", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;

  const Product = component(function Product() {
    const product = this.asyncSignal("product", async function () {
      await delay(0, this.abort);
      return { title: "Mouse" };
    });

    return html`
      <article id="custom-product" data-async-boundary="${product.id}">
        ${this.suspense(product, (product) => html`
          <h1 data-signal-text="${product.id}.title"></h1>
        `)}
      </article>
    `;
  });

  const loader = Loader({
    root: document,
    attributes: {
      async: "data-async-",
      signal: "data-signal-",
      on: "data-on-",
      class: "data-class-"
    }
  });
  loader.mount(document.querySelector("#app"), Product);
  await delay(5);

  assert.equal(document.querySelector("#custom-product").tagName, "ARTICLE");
  assert.equal(document.querySelector("h1").textContent, "Mouse");

  loader.destroy();
});

test("component this.suspense validates signal refs and view callbacks", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;

  const Errors = component(function Errors() {
    assert.throws(
      () => this.suspense(null, () => html``),
      /this\.suspense\(signalRef, views\) requires a signal ref/
    );
    assert.throws(
      () => this.suspense({ id: "product" }, null),
      /this\.suspense\(signalRef, views\) requires views to be a function or object/
    );
    assert.throws(
      () => this.suspense({ id: "product" }, { ready: "nope" }),
      /this\.suspense\(signalRef, views\) view "ready" must be a function/
    );

    return html`<span id="suspense-errors-ok">ok</span>`;
  });

  const loader = Loader({ root: document });
  loader.mount(document.querySelector("#app"), Errors);

  assert.equal(document.querySelector("#suspense-errors-ok").textContent, "ok");

  loader.destroy();
});
