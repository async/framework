import assert from "node:assert/strict";
import { test } from "node:test";
import { createHandlerRegistry, createServerRegistry, createSignalRegistry, signal } from "../../src/index.js";

test("handler registry supports initializer maps, command chains, built-ins, and this binding", async () => {
  const signals = createSignalRegistry({ count: signal(0) });
  const order = [];
  const event = {
    defaultPrevented: false,
    propagationStopped: false,
    immediateStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
    stopImmediatePropagation() {
      this.immediateStopped = true;
    }
  };

  const handlers = createHandlerRegistry({
    first() {
      order.push(["first", this.signals.get("count")]);
      this.signals.set("count", 1);
    },
    second() {
      order.push(["second", this.signals.get("count")]);
      return "done";
    }
  });

  const results = await handlers.run(" first ; prevent ; preventDefault ; ; second ; stopPropagation ; stopImmediatePropagation ", {
    signals,
    event
  });

  assert.deepEqual(order, [
    ["first", 0],
    ["second", 1]
  ]);
  assert.deepEqual(results, [undefined, "done"]);
  assert.equal(event.defaultPrevented, true);
  assert.equal(event.propagationStopped, true);
  assert.equal(event.immediateStopped, true);
});

test("server commands read signal args and apply returned signal patches", async () => {
  const signals = createSignalRegistry({
    productId: signal("sku-1"),
    quantity: signal(2),
    cartCount: signal(0)
  });
  const seen = [];
  const server = createServerRegistry({
    "cart.add": async function (productId, quantity) {
      seen.push([productId, quantity, this.input.value]);
      return serverEnvelope({
        value: { ok: true },
        signals: {
          cartCount: 3
        }
      });
    }
  });
  const handlers = createHandlerRegistry();

  const results = await handlers.run("server.cart.add(productId, quantity)", {
    signals,
    server,
    element: {
      value: "clicked",
      checked: false,
      dataset: {}
    }
  });

  assert.deepEqual(seen, [["sku-1", 2, "clicked"]]);
  assert.deepEqual(results, [{ ok: true }]);
  assert.equal(signals.get("cartCount"), 3);
});

test("server commands resolve event locals and default form input", async () => {
  const signals = createSignalRegistry({ productId: signal("sku-1") });
  const seen = [];
  const server = createServerRegistry({
    "products.save": function (productId, form, dataset) {
      seen.push({ productId, form, dataset, input: this.input });
      return "saved";
    }
  });
  const handlers = createHandlerRegistry();
  const formData = new Map([
    ["title", "Keyboard"],
    ["quantity", "2"]
  ]);
  const form = {
    tagName: "FORM",
    ownerDocument: {
      defaultView: {
        FormData: class FormData {
          entries() {
            return formData.entries();
          }
        }
      }
    }
  };
  const element = {
    form,
    dataset: { intent: "save" }
  };

  const results = await handlers.run("server.products.save(productId, $form, $dataset)", {
    signals,
    server,
    event: { type: "submit", target: form },
    element
  });

  assert.deepEqual(results, ["saved"]);
  assert.deepEqual(seen, [
    {
      productId: "sku-1",
      form: { title: "Keyboard", quantity: "2" },
      dataset: { intent: "save" },
      input: { title: "Keyboard", quantity: "2" }
    }
  ]);
});

function serverEnvelope(fields = {}) {
  return {
    __async_server_result__: 1,
    ...fields
  };
}

test("missing handlers fail with a useful error", async () => {
  const handlers = createHandlerRegistry();
  const reported = [];
  const originalReportError = globalThis.reportError;
  globalThis.reportError = (error) => reported.push(error);

  try {
    await assert.rejects(
      handlers.run("missing", {}),
      (error) => {
        assert.match(error.message, /Handler "missing" is not registered/);
        assert.equal(error.code, "handler-not-registered");
        assert.match(error.hint, /Async\.use/);
        assert.deepEqual(error.context, { handler: "missing" });
        return true;
      }
    );
    assert.deepEqual(reported, [], "direct handler rejections must not be reported globally");
  } finally {
    if (originalReportError === undefined) {
      delete globalThis.reportError;
    } else {
      globalThis.reportError = originalReportError;
    }
  }
});

test("invalid handler commands and unavailable server commands expose stable diagnostics", async () => {
  const handlers = createHandlerRegistry();

  await assert.rejects(
    handlers.run("save(bad value)", {}),
    (error) => error.code === "invalid-handler-command" && /Argument/.test(error.message)
  );
  await assert.rejects(
    handlers.run("server.products.save()", {}),
    (error) => error.code === "server-command-unavailable" && error.context.serverCommand === "products.save"
  );
});

test("handler registry unregister removes custom handlers", async () => {
  const handlers = createHandlerRegistry({
    save() {
      return "saved";
    }
  });

  assert.equal(typeof handlers.resolve("save"), "function");
  assert.equal(handlers.unregister("save"), true);
  assert.equal(handlers.resolve("save"), undefined);
  assert.equal(handlers.unregister("save"), false);

  await assert.rejects(
    handlers.run("save", {}),
    /Handler "save" is not registered/
  );
});

test("missing server functions fail with a useful error", async () => {
  const handlers = createHandlerRegistry();

  await assert.rejects(
    handlers.run("server.cart.missing()", {
      signals: createSignalRegistry(),
      server: createServerRegistry()
    }),
    /Server function "cart\.missing" is not registered/
  );
});

test("server commands reject raw DOM locals", async () => {
  const handlers = createHandlerRegistry();
  const server = createServerRegistry({
    track() {
      return null;
    }
  });

  await assert.rejects(
    handlers.run("server.track($event)", {
      signals: createSignalRegistry(),
      server,
      event: { type: "click" }
    }),
    /\$event cannot be passed to a server command/
  );
});
