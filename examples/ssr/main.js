import {
  createApp,
  createSignal,
  defineApp,
  defineCache,
  defineRoute,
  html
} from "../../src/index.js";

function sharedDefinition() {
  return {
    signal: {
      ssrDemo: createSignal({
        productId: null,
        selected: false
      })
    },
    cache: {
      browser: {
        "ssrDemo.product": defineCache({ ttl: 60_000 })
      }
    },
    handler: {
      "ssrDemo.selectProduct"() {
        this.signals.set("ssrDemo.selected", true);
      }
    },
    route: {
      "/ssr/:id": defineRoute("ssrDemo.product.page")
    }
  };
}

const serverApp = defineApp(sharedDefinition());
serverApp.use({
  cache: {
    server: {
      "ssrDemo.products.get": defineCache({ ttl: 30_000 })
    }
  },
  server: {
    async "ssrDemo.products.get"(id) {
      return this.cache.getOrSet(`ssrDemo.products:${id}`, () => {
        return {
          id,
          title: "SSR Keyboard"
        };
      }, { cache: "ssrDemo.products.get" });
    }
  },
  partial: {
    async "ssrDemo.product.page"({ id }) {
      const product = await this.server.ssrDemo.products.get(id);
      return {
        html: html`
          <article>
            <h1>${product.title}</h1>
            <p>${product.id}</p>
            <button type="button" on:click="ssrDemo.selectProduct" class:selected="ssrDemo.selected">
              Select
            </button>
          </article>
        `,
        signals: {
          "ssrDemo.productId": id
        },
        cache: {
          browser: {
            [`ssrDemo.product:${id}`]: product
          }
        }
      };
    }
  }
});

const serverRuntime = createApp(serverApp, { target: "server" });
const response = await serverRuntime.render("/ssr/sku-1");
serverRuntime.destroy();

document.querySelector("#app").innerHTML = response.html;

const snapshot = JSON.parse(document.querySelector("[async\\:snapshot]").textContent);
const browserApp = defineApp(sharedDefinition());
createApp(browserApp, {
  root: document,
  router: false,
  snapshot
}).start();
