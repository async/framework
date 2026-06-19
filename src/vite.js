import {
  RESOLVED_VIRTUAL_PLAN_ID,
  VIRTUAL_PLAN_ID,
  createBuildProfileReport,
  emitBootstrapModule,
  emitGeneratedPlanModule
} from "./build-profile.js";

export function asyncFramework(options = {}) {
  const host = normalizeViteHost(options.host);
  validateViteRolldownHost(host);
  const profile = createBuildProfileReport(options.fixture ?? {}, {
    mode: options.mode ?? "development"
  });

  return {
    name: "async-framework",
    enforce: "pre",
    asyncFramework: {
      profile,
      report: profile.report
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
      return profile.report;
    }
  };
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
