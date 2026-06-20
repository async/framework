import { defineConfig } from "vite";
import { qwikVite } from "@qwik.dev/core/optimizer";
import { qwikRouter } from "@qwik.dev/router/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(() => {
  return {
    // This tells vite where the build is deployed
    base: "/apps/qwik-v2/dist/",
    plugins: [
      qwikRouter({ basePathname: "/apps/qwik-v2/dist/" }),
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
