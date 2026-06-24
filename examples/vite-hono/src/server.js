import { Hono } from "hono";

const app = new Hono();

app.get("/", (context) => {
  const clientScript = import.meta.env?.DEV ? "/src/client.js" : "/static/client.js";

  return context.html(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Async Vite Hono</title>
      </head>
      <body async:container>
        <main async:app="vite-hono">
          <h1>Vite Hono App</h1>
          <button type="button" on:click="demo.increment" class:selected="demo.selected">
            Count <strong signal:text="demo.count"></strong>
          </button>
        </main>
        <script type="module" src="${clientScript}"></script>
      </body>
    </html>`);
});

export default app;
