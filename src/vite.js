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
  const host = normalizeViteHost(options.host);
  validateViteRolldownHost(host);
  const profile = createBuildProfileReport(options.fixture ?? {}, {
    mode: options.mode ?? "development"
  });
  const report = options.layer == null
    ? profile.report
    : { ...profile.report, layer: options.layer };

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
    configResolved(config) {
      validateViteRolldownHost(normalizeViteHost(options.host ?? config));
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
      if (!isJsxModule(id) || !usesAsyncJsx(code)) {
        return null;
      }
      return {
        code: emitBootstrapModule(profile),
        map: null
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

function isJsxModule(id) {
  return /\.(?:jsx|tsx)$/.test(String(id));
}

function usesAsyncJsx(source) {
  return /@async\/framework\/jsx/.test(source);
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
    base = "/",
    ...rest
  } = value;

  return {
    ...rest,
    entry,
    injectClientScript,
    base
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
