import {
  RESOLVED_VIRTUAL_PLAN_ID,
  VIRTUAL_PLAN_ID,
  createBuildProfileReport,
  emitBootstrapModule,
  emitGeneratedPlanModule
} from "./build-profile.js";

export function asyncFramework(options = {}) {
  const normalizedLayer = normalizeAsyncFrameworkLayer(options.layer);
  const serverOptions = normalizeHonoServerOptions(options.server);
  const clientOptions = normalizeClientBuildOptions(options.client);
  const importModule = options._importModule ?? ((id) => import(id));
  const plugin = createAsyncFrameworkPlugin({
    ...options,
    layer: normalizedLayer,
    server: serverOptions,
    client: clientOptions
  });

  if (!serverOptions) {
    return plugin;
  }

  return [
    plugin,
    loadHonoDevServerPlugin(serverOptions, importModule)
  ];
}

function createAsyncFrameworkPlugin(options = {}) {
  if (options.host != null) {
    validateViteRolldownHost(normalizeViteHost(options.host));
  }
  const profile = createBuildProfileReport(options.fixture ?? {}, {
    mode: options.mode ?? "development"
  });
  const report = options.layer == null
    ? profile.report
    : { ...profile.report, layer: options.layer };
  const replacedModules = new Set();

  return {
    name: "async-framework",
    enforce: "pre",
    asyncFramework: {
      profile,
      report,
      layer: options.layer
    },
    config(config = {}, env = {}) {
      const partial = {};
      if (options.server && !config.appType) {
        partial.appType = "custom";
      }
      if (options.client && env.mode === "client") {
        partial.build = createClientBuildConfig(config.build, options.client);
      }
      return Object.keys(partial).length > 0 ? partial : null;
    },
    configResolved() {
      if (options.host != null) {
        validateViteRolldownHost(normalizeViteHost(options.host));
        return;
      }
      const detected = detectViteHost(this?.meta);
      if (detected) {
        validateViteRolldownHost(detected);
      }
    },
    buildStart() {
      replacedModules.clear();
    },
    resolveId(id) {
      if (id === VIRTUAL_PLAN_ID) {
        return RESOLVED_VIRTUAL_PLAN_ID;
      }
      return null;
    },
    load(id) {
      if (id === RESOLVED_VIRTUAL_PLAN_ID) {
        return emitGeneratedPlanModule(profile);
      }
      return null;
    },
    transform(code, id) {
      if (!isJsxModule(id) || !importsAsyncJsx(code)) {
        return null;
      }
      const moduleId = String(id);
      if (!replacedModules.has(moduleId)) {
        replacedModules.add(moduleId);
        pluginLog(this, "info", `[async-framework] Replacing "${moduleId}" with the generated bootstrap module. Its own exports are not preserved; the module re-exports { plan, report, startAsyncFramework } from the build profile.`);
        if (replacedModules.size > 1) {
          pluginLog(this, "warn", `[async-framework] ${replacedModules.size} modules import @async/framework/jsx and all resolve to the same generated bootstrap. The current build profile supports one bootstrap module per app; keep JSX intent imports in a single entry module. Replaced modules: ${[...replacedModules].join(", ")}.`);
        }
      }
      return {
        code: emitBootstrapModule(profile),
        map: { mappings: "" }
      };
    },
    getAsyncFrameworkReport() {
      return report;
    }
  };
}

export function normalizeAsyncFrameworkLayer(layer) {
  if (layer == null) {
    return undefined;
  }
  if (layer === 1 || layer === "1") {
    return 1;
  }
  if (layer === 1.5 || layer === "1.5") {
    return 1.5;
  }
  throw new TypeError('asyncFramework({ layer }) only supports 1, "1", 1.5, or "1.5".');
}

export function validateViteRolldownHost(host = {}) {
  const normalized = normalizeViteHost(host);
  if (normalized.name !== "vite") {
    throw new Error(`@async/framework/vite requires Vite 8+ with Rolldown; received ${normalized.name}.`);
  }
  if (Number.parseInt(normalized.version, 10) < 8) {
    throw new Error(`@async/framework/vite requires Vite 8+; received ${normalized.version}.`);
  }
  if (normalized.engine !== "rolldown") {
    throw new Error(`@async/framework/vite requires the Rolldown engine; received ${normalized.engine}.`);
  }
  return normalized;
}

export function normalizeViteHost(host = {}) {
  const builder = host.builder && typeof host.builder === "object" ? host.builder.name : host.builder;
  return {
    name: host.name ?? "vite",
    version: String(host.version ?? host.viteVersion ?? host.versionMajor ?? "8.0.0"),
    engine: host.engine ?? builder ?? (host.rolldown === false ? "rollup" : "rolldown")
  };
}

export function detectViteHost(meta) {
  if (!meta || typeof meta !== "object") {
    return undefined;
  }
  const viteVersion = meta.viteVersion == null ? undefined : String(meta.viteVersion);
  const rolldownVersion = meta.rolldownVersion == null ? undefined : String(meta.rolldownVersion);
  if (viteVersion === undefined && rolldownVersion === undefined) {
    return undefined;
  }
  const major = Number.parseInt(viteVersion ?? "", 10);
  const engine = rolldownVersion !== undefined || (Number.isFinite(major) && major >= 8)
    ? "rolldown"
    : "rollup";
  return {
    name: "vite",
    version: viteVersion ?? "8.0.0",
    engine
  };
}

function pluginLog(context, level, message) {
  if (context && typeof context[level] === "function") {
    context[level](message);
  }
}

function isJsxModule(id) {
  return /\.(?:jsx|tsx)$/.test(String(id));
}

const ASYNC_JSX_SPECIFIER = String.raw`["']@async\/framework\/jsx(?:\/[\w./-]*)?["']`;
const ASYNC_JSX_IMPORT_PATTERNS = [
  // import defaultExport, { named } from "@async/framework/jsx/..."; export { x } from "...";
  new RegExp(String.raw`\bfrom\s*${ASYNC_JSX_SPECIFIER}`),
  // side-effect import "@async/framework/jsx/...";
  new RegExp(String.raw`\bimport\s*${ASYNC_JSX_SPECIFIER}`),
  // dynamic import("@async/framework/jsx/...")
  new RegExp(String.raw`\bimport\s*\(\s*${ASYNC_JSX_SPECIFIER}\s*\)`)
];

export function importsAsyncJsx(source) {
  const code = stripJsComments(String(source));
  return ASYNC_JSX_IMPORT_PATTERNS.some((pattern) => pattern.test(code));
}

function stripJsComments(source) {
  let out = "";
  let index = 0;
  let state = "code";
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (state === "code") {
      if (char === "/" && next === "/") {
        state = "line";
        index += 2;
        continue;
      }
      if (char === "/" && next === "*") {
        state = "block";
        index += 2;
        continue;
      }
      if (char === "'") {
        state = "single";
      } else if (char === '"') {
        state = "double";
      } else if (char === "`") {
        state = "template";
      }
      out += char;
      index += 1;
      continue;
    }
    if (state === "line") {
      if (char === "\n") {
        state = "code";
        out += char;
      }
      index += 1;
      continue;
    }
    if (state === "block") {
      if (char === "*" && next === "/") {
        state = "code";
        out += " ";
        index += 2;
        continue;
      }
      if (char === "\n") {
        out += char;
      }
      index += 1;
      continue;
    }
    if (char === "\\") {
      out += char + (next ?? "");
      index += 2;
      continue;
    }
    if ((state === "single" && char === "'")
      || (state === "double" && char === '"')
      || (state === "template" && char === "`")) {
      state = "code";
    }
    out += char;
    index += 1;
  }
  return out;
}

function normalizeHonoServerOptions(server) {
  if (server == null || server === false) {
    return undefined;
  }
  if (server !== true && (!server || typeof server !== "object" || Array.isArray(server))) {
    throw new TypeError("asyncFramework({ server }) expects true or a server options object.");
  }

  const value = server === true ? {} : server;
  if (Object.hasOwn(value, "target")) {
    throw new Error("asyncFramework({ server }) does not accept server.target yet. Vercel support uses the native Hono default export.");
  }

  const {
    entry = "src/server.js",
    injectClientScript = true,
    ...rest
  } = value;

  // `base` is intentionally not defaulted: @hono/vite-dev-server treats any
  // defined `base` as an explicit Vite base override. It only flows through
  // (via rest) when the app author sets it.
  return {
    ...rest,
    entry,
    injectClientScript
  };
}

function normalizeClientBuildOptions(client) {
  if (client == null || client === false) {
    return undefined;
  }
  if (client !== true && (!client || typeof client !== "object" || Array.isArray(client))) {
    throw new TypeError("asyncFramework({ client }) expects true or a client options object.");
  }

  const value = client === true ? {} : client;
  return {
    entry: value.entry ?? "src/client.js",
    outDir: value.outDir ?? "public/static"
  };
}

async function loadHonoDevServerPlugin(serverOptions, importModule) {
  let module;
  try {
    module = await importModule("@hono/vite-dev-server");
  } catch (cause) {
    throw new Error('asyncFramework({ server }) requires Hono dev dependencies. Install "hono" and "@hono/vite-dev-server" in your app.', {
      cause
    });
  }

  const devServer = module.default ?? module.devServer;
  if (typeof devServer !== "function") {
    throw new TypeError("@hono/vite-dev-server did not expose a Vite plugin factory.");
  }
  return devServer(serverOptions);
}

function createClientBuildConfig(existingBuild = {}, clientOptions) {
  const build = existingBuild && typeof existingBuild === "object" ? existingBuild : {};
  const rollupOptions = build.rollupOptions && typeof build.rollupOptions === "object"
    ? build.rollupOptions
    : {};
  return {
    ...build,
    outDir: build.outDir ?? clientOptions.outDir,
    copyPublicDir: build.copyPublicDir ?? false,
    rollupOptions: {
      ...rollupOptions,
      input: rollupOptions.input ?? clientOptions.entry,
      output: rollupOptions.output ?? {
        entryFileNames: clientEntryFileName(clientOptions.entry)
      }
    }
  };
}

function clientEntryFileName(entry) {
  const name = String(entry).split(/[\\/]/).pop() || "client.js";
  return name.replace(/\.[cm]?[jt]sx?$/, ".js");
}
