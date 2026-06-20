import fastifyStatic from "@fastify/static";
import path from "node:path";
import { cwd } from "node:process";

import { appsDirectory } from "../config/directories.js";
import { generateAndServeIndex } from "../frameworks/frameworksControllers.js";
import { FastifyInstance } from "fastify";

const projectRootPath = path.join(cwd(), "..");
const frameworkSourcePath = path.join(projectRootPath, "..", "src");

async function routes(fastify: FastifyInstance) {
  fastify.register(fastifyStatic, {
    root: appsDirectory,
    prefix: "/apps",
    setHeaders: (res, path) => {
      if (fastify.csp.isEnabled && path.endsWith("index.html")) {
        res.setHeader("Content-Security-Policy", "default-src 'self'; report-uri /csp");
      }
    },
  });

  fastify.register(fastifyStatic, {
    root: path.join(projectRootPath, "css"),
    prefix: "/css",
    decorateReply: false,
  });

  fastify.register(fastifyStatic, {
    root: frameworkSourcePath,
    prefix: "/framework",
    decorateReply: false,
  });

  fastify.get("/", generateAndServeIndex);
  fastify.get("/index.html", generateAndServeIndex);
}

export default routes;
