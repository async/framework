import { Async } from "../../src/index.js";

const boundary = "account";
const partialHeaders = {
  Accept: "application/x-async-partial",
  "x-async-boundary": boundary
};

Async.use({
  handler: {
    async "hateoas.follow"({ event }) {
      const link = event.target.closest("a");
      if (!link) {
        return;
      }

      await swapPartial(this.loader, link.href, {
        method: "GET",
        headers: partialHeaders
      });
    },

    async "hateoas.submit"({ event }) {
      const form = event.target;
      const method = form.method.toUpperCase();
      const url = new URL(form.action, window.location.href);
      const body = new URLSearchParams(new FormData(form));
      const request = {
        method,
        headers: partialHeaders
      };

      if (method === "GET") {
        url.search = body.toString();
      } else {
        request.body = body;
      }

      await swapPartial(this.loader, url, request);
    }
  }
});

Async.start({ root: document, router: false });

async function swapPartial(loader, url, request) {
  const response = await fetch(url, request);
  if (!response.ok) {
    throw new Error(`HATEOAS request failed: ${response.status}`);
  }

  await loader.swap(boundary, await response.text());
}
