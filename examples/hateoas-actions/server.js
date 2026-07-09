import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number.parseInt(process.env.PORT ?? "4174", 10);
const root = dirname(fileURLToPath(import.meta.url));
const frameworkRoot = resolve(root, "..", "..");
const frameworkSrc = join(frameworkRoot, "src");
const app = new Hono();

const account = {
  id: "12345",
  balance: 100,
  closed: false,
  message: ""
};

app.get("/main.js", async (context) => {
  const source = await readFile(join(root, "main.js"), "utf8");
  return context.text(source, 200, { "content-type": "text/javascript; charset=utf-8" });
});

app.get("/src/*", async (context) => {
  const requestPath = context.req.path.replace(/^\/src\//, "");
  const filePath = resolve(frameworkSrc, requestPath);
  if (!filePath.startsWith(`${frameworkSrc}${sep}`)) {
    return context.notFound();
  }

  const source = await readFile(filePath, "utf8");
  return context.text(source, 200, { "content-type": "text/javascript; charset=utf-8" });
});

app.get("/", (context) => sendView(context, renderAccount()));
app.get("/accounts/:id", (context) => sendView(context, renderAccount()));

app.get("/accounts/:id/deposits", (context) => sendView(context, renderMoneyForm({
  title: "Deposit",
  action: `/accounts/${account.id}/deposits`,
  button: "Deposit"
})));

app.post("/accounts/:id/deposits", async (context) => {
  const amount = await readAmount(context);
  account.balance += amount;
  account.message = `Deposited ${formatMoney(amount)}.`;
  return sendView(context, renderAccount());
});

app.get("/accounts/:id/withdrawals", (context) => sendView(context, renderMoneyForm({
  title: "Withdraw",
  action: `/accounts/${account.id}/withdrawals`,
  button: "Withdraw"
})));

app.post("/accounts/:id/withdrawals", async (context) => {
  const amount = await readAmount(context);
  account.balance -= amount;
  account.message = `Withdrew ${formatMoney(amount)}.`;
  return sendView(context, renderAccount());
});

app.get("/accounts/:id/transfers", (context) => sendView(context, renderTransferForm()));

app.post("/accounts/:id/transfers", async (context) => {
  const form = await readForm(context);
  const amount = parseMoney(form.get("amount"));
  const to = form.get("to")?.toString().trim() || "external account";
  account.balance -= amount;
  account.message = `Transferred ${formatMoney(amount)} to ${escapeHtml(to)}.`;
  return sendView(context, renderAccount());
});

app.get("/accounts/:id/close-requests", (context) => sendView(context, renderCloseForm()));

app.post("/accounts/:id/close-requests", (context) => {
  account.closed = true;
  account.message = "Close request submitted.";
  return sendView(context, renderAccount());
});

serve({
  fetch: app.fetch,
  hostname: "127.0.0.1",
  port
}, () => {
  console.log(`HATEOAS actions example: http://127.0.0.1:${port}/`);
});

function sendView(context, fragment, status = 200) {
  return context.html(wantsPartial(context) ? fragment : renderPage(fragment), status);
}

function wantsPartial(context) {
  return context.req.header("accept")?.includes("application/x-async-partial") ||
    context.req.header("x-async-boundary") === "account";
}

async function readAmount(context) {
  const form = await readForm(context);
  return parseMoney(form.get("amount"));
}

async function readForm(context) {
  return new URLSearchParams(await context.req.text());
}

function renderPage(fragment) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Async HATEOAS Actions</title>
  </head>
  <body>
    <main async:container>
      <h1>HATEOAS account</h1>
      <p>
        The server owns the view and decides which links and forms are valid.
        Async only enhances the same hypermedia controls into boundary swaps.
      </p>
      <section async:boundary="account">
        ${fragment}
      </section>
    </main>
    <script type="module" src="/main.js"></script>
  </body>
</html>`;
}

function renderAccount() {
  const controls = [];
  if (!account.closed) {
    controls.push(link("Deposit", `/accounts/${account.id}/deposits`));
    if (account.balance >= 0) {
      controls.push(link("Withdraw", `/accounts/${account.id}/withdrawals`));
      controls.push(link("Transfer", `/accounts/${account.id}/transfers`));
      controls.push(link("Request close", `/accounts/${account.id}/close-requests`));
    }
  }

  return `<article>
  ${account.message ? `<p role="status">${account.message}</p>` : ""}
  <dl>
    <dt>Account number</dt>
    <dd>${account.id}</dd>
    <dt>Balance</dt>
    <dd>${formatMoney(account.balance)}</dd>
    <dt>Status</dt>
    <dd>${account.closed ? "Close requested" : account.balance < 0 ? "Overdrawn" : "Open"}</dd>
  </dl>
  <nav aria-label="Available account actions">
    ${controls.length ? controls.join("\n    ") : "<span>No actions available</span>"}
  </nav>
</article>`;
}

function renderMoneyForm({ title, action, button }) {
  return `<form method="post" action="${action}" on:submit="preventDefault; hateoas.submit($event)">
  <h2>${title}</h2>
  <label>
    Amount
    <input name="amount" type="number" min="1" step="1" required>
  </label>
  <button type="submit">${button}</button>
  ${backLink()}
</form>`;
}

function renderTransferForm() {
  return `<form method="post" action="/accounts/${account.id}/transfers" on:submit="preventDefault; hateoas.submit($event)">
  <h2>Transfer</h2>
  <label>
    To
    <input name="to" value="Savings" required>
  </label>
  <label>
    Amount
    <input name="amount" type="number" min="1" step="1" required>
  </label>
  <button type="submit">Transfer</button>
  ${backLink()}
</form>`;
}

function renderCloseForm() {
  return `<form method="post" action="/accounts/${account.id}/close-requests" on:submit="preventDefault; hateoas.submit($event)">
  <h2>Request account close</h2>
  <p>The server only exposes this form while the account is open and not overdrawn.</p>
  <button type="submit">Submit close request</button>
  ${backLink()}
</form>`;
}

function link(label, href) {
  return `<a href="${href}" on:click="preventDefault; hateoas.follow($event)">${label}</a>`;
}

function backLink() {
  return `<p>${link("Back to account", `/accounts/${account.id}`)}</p>`;
}

function parseMoney(value) {
  const amount = Number.parseFloat(value?.toString() ?? "");
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function formatMoney(value) {
  return `${value < 0 ? "-" : ""}$${Math.abs(value).toFixed(2)} USD`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
