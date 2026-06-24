import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { asyncFramework } from "../../src/vite.js";
import streamingProfile from "./src/streaming-profile.json" with { type: "json" };

function sourcePath(path) {
  return fileURLToPath(new URL(`../../src/${path}`, import.meta.url));
}

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "@async/framework/jsx/runtime"
  },
  resolve: {
    alias: [
      {
        find: "@async/framework/jsx/runtime/jsx-dev-runtime",
        replacement: sourcePath("jsx/runtime/jsx-dev-runtime.js")
      },
      {
        find: "@async/framework/jsx/runtime/jsx-runtime",
        replacement: sourcePath("jsx/runtime/jsx-runtime.js")
      },
      {
        find: "@async/framework/jsx/runtime",
        replacement: sourcePath("jsx/runtime.js")
      },
      {
        find: "@async/framework/jsx",
        replacement: sourcePath("jsx.js")
      },
      {
        find: "@async/framework/runtime",
        replacement: sourcePath("runtime.js")
      }
    ]
  },
  plugins: [
    asyncFramework({
      layer: 1.5,
      fixture: streamingProfile,
      client: {
        entry: "src/main.js",
        outDir: "dist/static"
      }
    })
  ]
});
