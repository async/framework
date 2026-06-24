# Vite Hono Example

Shows the default Hono-backed Vite setup for an L1 browser app:

- `vite.config.js` enables `asyncFramework({ server, client })`.
- `src/server.js` default-exports the Hono app used by local Vite development
  and by production hosts that understand Hono.
- `src/client.js` stays ordinary L1 browser runtime code.

Start from this directory:

```bash
pnpm install
pnpm run dev
```

Build client assets for production:

```bash
pnpm run build
```

The checked-in config imports the framework plugin from the source checkout so
the example can run here before a package is installed. In an app, import
`asyncFramework` from `@async/framework/vite` and import browser APIs from
`@async/framework/browser`.
