import { defineConfig } from "vite";
import { asyncFramework } from "../../src/vite.js";

export default defineConfig({
  plugins: [
    asyncFramework({
      layer: 1,
      server: {
        entry: "src/server.js"
      },
      client: {
        entry: "src/client.js",
        outDir: "public/static"
      }
    })
  ]
});
