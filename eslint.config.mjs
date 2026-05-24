import tseslint from "typescript-eslint";

const restrictedImportPatterns = [
  "fs",
  "node:fs",
  "path",
  "node:path",
  "os",
  "node:os",
  "net",
  "node:net",
  "tls",
  "node:tls",
  "dgram",
  "node:dgram",
  "dns",
  "node:dns",
  "child_process",
  "node:child_process",
  "worker_threads",
  "node:worker_threads",
  "module",
  "node:module",
];

const protectedFiles = [
  "frameworks/**/*.{ts,tsx,js,mjs}",
  "prototype/async-framework-v0/**/*.{ts,tsx,js,mjs}",
  "prototype/async-framework-v1/src/**/*.{ts,tsx,js,mjs}",
  "prototype/async-framework-v1/index.ts",
  "packages/async-framework/**/*.{ts,tsx,js,mjs}",
];

const adapterExceptionFiles = [
  "runtime/node/**/*.{ts,tsx,js,mjs}",
  "benchmarks/**/*.{ts,tsx,js,mjs}",
  "**/*.config.{js,mjs,ts}",
];

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "packages/examples/qwik-hello-world/**",
    ],
  },
  {
    files: protectedFiles,
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: restrictedImportPatterns,
              message:
                "WinterCG policy: use Web-standard APIs in shared core code, or isolate runtime-specific logic in adapters.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "process",
          message:
            "WinterCG policy: avoid Node-only globals in shared core code. Use an adapter.",
        },
        {
          name: "Buffer",
          message:
            "WinterCG policy: avoid Node-only globals in shared core code. Use Uint8Array/TextEncoder/Web APIs.",
        },
        {
          name: "__dirname",
          message:
            "WinterCG policy: avoid CommonJS globals in shared core code. Use import.meta.url patterns in adapters.",
        },
        {
          name: "__filename",
          message:
            "WinterCG policy: avoid CommonJS globals in shared core code. Use import.meta.url patterns in adapters.",
        },
      ],
    },
  },
  {
    files: adapterExceptionFiles,
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-globals": "off",
    },
  },
];
