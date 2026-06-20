import { defineConfig } from "vite";
import { qwikVite } from "@qwik.dev/core/optimizer";
import { qwikRouter } from "@qwik.dev/router/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(() => {
  return {
    // This tells vite where the build is deployed
    base: "/frameworks/keyed/qwik-v2/dist/",
    plugins: [
      qwikRouter({ basePathname: "/frameworks/keyed/qwik-v2/dist/" }),
      qwikVite(),
      tsconfigPaths(),
    ],
    preview: {
      headers: {
        "Cache-Control": "public, max-age=600",
      },
    },
    server: {
      fs: {
        allow: ["../../.."],
      },
    },
  };
});
