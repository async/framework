# Runtime policy

This repository is Node-first for local development and CI, but shared framework code follows a WinterCG-first compatibility contract.

## Contract

- Shared framework code uses Web-standard APIs first.
- Node-only APIs are allowed only in explicit runtime adapters.
- Runtime-specific behavior belongs in dedicated folders (for example `runtime/node`).

## Enforcement

Run:

`pnpm lint:wintercg`

The lint rule blocks Node-only imports/globals in protected core paths and helps keep the codebase portable to both Node.js and Deno.
