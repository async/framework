# HATEOAS Actions Example

Shows an L0 server-led HATEOAS flow: a Hono backend renders the account view,
links to the actions that are currently valid, and forms that carry their own
`method`, `action`, and input shape.

Key files:

- `server.js` uses Hono routes and plain template literals to render full
  documents or account fragments from server state.
- `main.js` is a tiny progressive enhancement that follows links and submits
  forms with the same verbs and URLs, then swaps the returned fragment into an
  `async:boundary`.

Start from this directory:

```bash
pnpm install
pnpm start
```

Open `http://127.0.0.1:4174/`.

Try withdrawing enough to overdraw the account. The next account response only
contains a deposit action; the browser does not know that rule. It only follows
the controls included in the returned HTML.
