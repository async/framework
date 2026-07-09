# Contributing

`@async/pipeline` owns GitHub Actions, Pages, and release lifecycle automation.
Edit [`pipeline.ts`](./pipeline.ts), then regenerate:

```bash
pnpm run pipeline:sync:generate
pnpm run pipeline:sync:check
pnpm run pipeline:github:check
```

Useful commands:

```bash
pnpm run bundle
pnpm run bundle:clean
pnpm run pipeline:verify
pnpm run pipeline:pages
pnpm run registry:lint
pnpm run pipeline:release:doctor
pnpm run release:check
```

Release artifacts such as `browser.js`, `browser.min.js`,
`browser.umd.min.js`, `browser.ts`, `browser.d.ts`, `framework.ts`,
`framework.d.ts`, and `server.js` are generated into `dist/`. The generated
`dist/` directory is the package root for `npm pack` and release publishing, so
the published package and CDN surface still expose those files at package root
rather than under `dist/`. The source `package.json` stays private and owns the
minimal public export spec, while omitting legacy `main`/`module`/`browser`
entry fields and generated package file lists. `scripts/build-framework-bundle.js`
derives the generated `dist/package.json` and staged artifact names from that
spec. Feature branches should edit source files and let `pnpm run bundle`,
`pnpm test`, or the generated release workflow materialize the publish tree.
Use `pnpm run bundle:clean` to remove local generated artifacts after
inspection.

`registry:lint` scans package source and examples for declared registry ids
such as signals, handlers, server functions, partials, routes, and components.
It writes `.async/registry-manifest.json` plus a per-file cache at
`.async/registry-lint-cache.json`, skips generated root bundles such as
`browser.umd.min.js`, and fails only when the same registry type and id are
declared with different normalized content. Duplicate declarations with the
same content are reported as dedupe candidates, not errors.

GitHub Pages builds through the generated `pages` job. Enable Pages before the
generated job deploys the docs site.

Stable releases use the generated `publish` job: it verifies the package,
creates or verifies the tag and GitHub Release, publishes npm with provenance,
then runs release doctor.

## Related
- Runtime checks: [README](./README.md#contributing--release)
- Pipeline source: [pipeline.ts](./pipeline.ts)
- Packaging contract: [09-packaging-and-delivery.md](./specs/framework/09-packaging-and-delivery.md)
