import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { defineAsyncContainerElement, defineAsyncSuspenseElement } from "../src/elements.js";

test("defineAsyncContainerElement attaches and detaches app roots across the element lifecycle", () => {
  const window = new Window();
  const { document } = window;
  const attached = [];
  const detached = [];
  const app = {
    _runtime: {
      attachRoot(root) {
        attached.push(root);
      },
      detachRoot(root) {
        detached.push(root);
      }
    }
  };

  const AsyncContainer = defineAsyncContainerElement({
    app,
    tagName: "probe-container",
    customElements: window.customElements,
    HTMLElement: window.HTMLElement
  });

  assert.equal(window.customElements.get("probe-container"), AsyncContainer);
  const element = document.createElement("probe-container");
  assert.equal(element instanceof AsyncContainer, true);

  document.body.appendChild(element);
  assert.deepEqual(attached, [element]);

  element.connectedCallback();
  assert.deepEqual(attached, [element], "repeated connects must not double-attach");

  element.remove();
  assert.deepEqual(detached, [element]);

  element.disconnectedCallback();
  assert.deepEqual(detached, [element], "repeated disconnects must not double-detach");

  const fresh = document.createElement("probe-container");
  fresh.disconnectedCallback();
  assert.deepEqual(detached, [element], "never-connected elements must not detach");

  document.body.appendChild(element);
  assert.deepEqual(attached, [element, element], "reconnecting re-attaches the root");
  element.remove();
  assert.deepEqual(detached, [element, element]);
});

test("defineAsyncContainerElement starts the app when no runtime is active", () => {
  const window = new Window();
  const { document } = window;
  let starts = 0;
  const attached = [];
  const app = {
    start() {
      starts += 1;
      return {
        attachRoot(root) {
          attached.push(root);
        }
      };
    }
  };

  defineAsyncContainerElement({
    Async: app,
    tagName: "start-container",
    customElements: window.customElements,
    HTMLElement: window.HTMLElement
  });

  const element = document.createElement("start-container");
  document.body.appendChild(element);
  assert.equal(starts, 1);
  assert.deepEqual(attached, [element]);

  element.remove();
  document.body.appendChild(element);
  assert.equal(starts, 2, "reconnect starts again while the app reports no runtime");
  assert.deepEqual(attached, [element, element]);
});

test("defineAsyncContainerElement tolerates apps without runtimes or root hooks", () => {
  const window = new Window();
  const { document } = window;
  defineAsyncContainerElement({
    app: {},
    tagName: "bare-container",
    customElements: window.customElements,
    HTMLElement: window.HTMLElement
  });

  const element = document.createElement("bare-container");
  document.body.appendChild(element);
  assert.equal(element.__asyncAttached, true);
  element.remove();
  assert.equal(element.__asyncAttached, false);
});

test("defineAsyncContainerElement returns the existing definition instead of redefining", () => {
  const window = new Window();
  const app = {};
  const first = defineAsyncContainerElement({
    app,
    customElements: window.customElements,
    HTMLElement: window.HTMLElement
  });
  const second = defineAsyncContainerElement({
    app,
    customElements: window.customElements,
    HTMLElement: window.HTMLElement
  });

  assert.equal(second, first);
  assert.equal(window.customElements.get("async-container"), first);
});

test("defineAsyncContainerElement requires a custom element registry and a base class", () => {
  assert.equal(globalThis.customElements, undefined, "test expects no global custom element registry");
  assert.equal(globalThis.HTMLElement, undefined, "test expects no global HTMLElement");

  assert.throws(
    () => defineAsyncContainerElement(),
    /defineAsyncContainerElement\(\.\.\.\) requires customElements/
  );

  const registry = { get: () => undefined, define() {} };
  assert.throws(
    () => defineAsyncContainerElement({ app: {}, customElements: registry }),
    /defineAsyncContainerElement\(\.\.\.\) requires HTMLElement/
  );
});

test("defineAsyncContainerElement uses the provided window for the base class", () => {
  const window = new Window();
  const defined = [];
  const registry = {
    get: () => undefined,
    define(tagName, constructor) {
      defined.push([tagName, constructor]);
    }
  };

  const AsyncContainer = defineAsyncContainerElement({
    app: {},
    customElements: registry,
    window
  });

  assert.equal(Object.getPrototypeOf(AsyncContainer), window.HTMLElement);
  assert.deepEqual(defined, [["async-container", AsyncContainer]]);
});

test("defineAsyncSuspenseElement defines an inert custom element with custom tag names", () => {
  const window = new Window();
  const { document } = window;
  const AsyncSuspense = defineAsyncSuspenseElement({
    tagName: "probe-suspense",
    customElements: window.customElements,
    HTMLElement: window.HTMLElement
  });

  assert.equal(window.customElements.get("probe-suspense"), AsyncSuspense);
  const element = document.createElement("probe-suspense");
  assert.equal(element instanceof AsyncSuspense, true);
  document.body.appendChild(element);
  element.remove();
  assert.equal(element.isConnected, false);
});

test("defineAsyncSuspenseElement returns the existing definition instead of redefining", () => {
  const window = new Window();
  const first = defineAsyncSuspenseElement({
    customElements: window.customElements,
    HTMLElement: window.HTMLElement
  });
  const second = defineAsyncSuspenseElement({
    customElements: window.customElements,
    HTMLElement: window.HTMLElement
  });

  assert.equal(second, first);
  assert.equal(window.customElements.get("async-suspense"), first);
});

test("defineAsyncSuspenseElement requires a registry and base class and accepts window bases", () => {
  assert.throws(
    () => defineAsyncSuspenseElement(),
    /defineAsyncSuspenseElement\(\.\.\.\) requires customElements/
  );

  const bareRegistry = { get: () => undefined, define() {} };
  assert.throws(
    () => defineAsyncSuspenseElement({ customElements: bareRegistry }),
    /defineAsyncSuspenseElement\(\.\.\.\) requires HTMLElement/
  );

  const window = new Window();
  const defined = [];
  const registry = {
    get: () => undefined,
    define(tagName) {
      defined.push(tagName);
    }
  };
  const AsyncSuspense = defineAsyncSuspenseElement({ customElements: registry, window });
  assert.equal(Object.getPrototypeOf(AsyncSuspense), window.HTMLElement);
  assert.deepEqual(defined, ["async-suspense"]);
});
