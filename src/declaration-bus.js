const systemBrand = Symbol.for("@async/framework.system");
const systemCache = new Map();
const duplicatePolicyNames = new Set(["warn", "strict", "ignore"]);
const materializationPolicies = new Set(["on-register", "on-start", "on-demand"]);
const duplicatePolicyDefaults = Object.freeze({
  modules: "warn",
  declarations: "warn",
  resolvers: "strict"
});

export const system = Object.freeze({
  for(id) {
    if (typeof id !== "string" || id.trim().length === 0) {
      throw new TypeError("system.for(id) requires a non-empty string.");
    }
    const normalized = id.trim();
    let identity = systemCache.get(normalized);
    if (!identity) {
      identity = Object.freeze({
        id: normalized,
        key: Symbol.for(`@async/framework.system:${normalized}`),
        [systemBrand]: true
      });
      systemCache.set(normalized, identity);
    }
    return identity;
  }
});

export function createDeclarationBus(options = {}) {
  const declarations = new Map();
  const conventions = new Map();
  const modules = new Map();
  const collisions = [];
  let duplicatePolicies = normalizeDuplicatePolicies(options.duplicates);
  let order = 0;

  const bus = {
    configure(config = {}) {
      duplicatePolicies = normalizeDuplicatePolicies(config.duplicates, duplicatePolicies);
      return bus;
    },

    register(kind, id, value, context = {}) {
      assertKind(kind);
      assertId(kind, id);
      const entries = declarationMap(kind);
      if (entries.has(id)) {
        handleDuplicate("declarations", `${kind}:${id}`, `${kind} "${id}" is already declared.`);
        return undefined;
      }
      const record = {
        kind,
        id,
        value,
        order: ++order,
        owner: undefined,
        policy: undefined,
        materialized: new Map(),
        startMaterialized: new WeakMap()
      };
      entries.set(id, record);
      classify(record);
      maybeMaterialize(record, "on-register", context);
      return record;
    },

    registerMany(kind, entries = {}, context = {}) {
      for (const [id, value] of Object.entries(entries ?? {})) {
        bus.register(kind, id, value, context);
      }
      return bus;
    },

    registerConventions(map = {}, context = {}) {
      for (const [kind, convention] of Object.entries(map ?? {})) {
        bus.registerConvention(kind, convention, context);
      }
      return bus;
    },

    registerConvention(kind, convention = {}, context = {}) {
      assertKind(kind);
      if (conventions.has(kind)) {
        handleDuplicate("resolvers", kind, `Convention for "${kind}" is already registered.`);
        return undefined;
      }
      const normalized = normalizeConvention(kind, convention);
      conventions.set(kind, normalized);
      for (const record of declarationMap(kind).values()) {
        classify(record);
        maybeMaterialize(record, "on-register", context);
      }
      return normalized;
    },

    installModules(map = {}, context = {}) {
      for (const [fallbackId, moduleDefinition] of normalizeModules(map)) {
        bus.installModule(moduleDefinition, context, fallbackId);
      }
      return bus;
    },

    installModule(moduleDefinition = {}, context = {}, fallbackId) {
      const normalized = normalizeModule(moduleDefinition, fallbackId);
      if (modules.has(normalized.key)) {
        handleDuplicate("modules", normalized.id, `Module "${normalized.id}" is already installed.`);
        return modules.get(normalized.key);
      }
      modules.set(normalized.key, normalized);
      normalized.install?.({
        app: context.app,
        registry: context.registry,
        declarations: bus,
        module: normalized
      });
      return normalized;
    },

    start(context = {}) {
      for (const record of orderedRecords()) {
        maybeMaterialize(record, "on-start", context);
      }
      return bus;
    },

    resolve(kind, id, context = {}) {
      assertKind(kind);
      assertId(kind, id);
      const record = declarationMap(kind).get(id);
      if (!record) {
        return undefined;
      }
      const convention = conventions.get(kind);
      if (!convention) {
        return undefined;
      }
      classify(record);
      if (convention.policy === "on-demand") {
        return materialize(record, convention, context);
      }
      if (convention.policy === "on-start") {
        return readStartCache(record, context);
      }
      return record.materialized.get("on-register");
    },

    has(kind, id) {
      assertKind(kind);
      assertId(kind, id);
      return declarationMap(kind).has(id);
    },

    get(kind, id) {
      assertKind(kind);
      assertId(kind, id);
      return declarationMap(kind).get(id)?.value;
    },

    keys(kind) {
      assertKind(kind);
      return [...declarationMap(kind).keys()];
    },

    entries(kind) {
      assertKind(kind);
      return [...declarationMap(kind).values()].map((record) => [
        record.id,
        record.value
      ]);
    },

    conventions() {
      return [...conventions].map(([kind, convention]) => [
        kind,
        publicConvention(convention)
      ]);
    },

    modules() {
      return [...modules.values()].map((module) => ({
        id: module.id,
        owner: module.owner.id
      }));
    },

    collisions() {
      return collisions.map((collision) => ({ ...collision }));
    },

    inspect() {
      return {
        duplicates: { ...duplicatePolicies },
        declarations: Object.fromEntries([...declarations].map(([kind, records]) => [
          kind,
          [...records.values()].map((record) => ({
            id: record.id,
            owner: record.owner?.id,
            policy: record.policy,
            materialized: materializedPhases(record)
          }))
        ])),
        conventions: Object.fromEntries(bus.conventions()),
        modules: bus.modules(),
        collisions: bus.collisions()
      };
    },

    _policies() {
      return { ...duplicatePolicies };
    }
  };

  return bus;

  function declarationMap(kind) {
    let entries = declarations.get(kind);
    if (!entries) {
      entries = new Map();
      declarations.set(kind, entries);
    }
    return entries;
  }

  function orderedRecords() {
    return [...declarations.values()]
      .flatMap((records) => [...records.values()])
      .sort((left, right) => left.order - right.order);
  }

  function classify(record) {
    const convention = conventions.get(record.kind);
    if (!convention) {
      record.owner = undefined;
      record.policy = undefined;
      return record;
    }
    record.owner = convention.owner;
    record.policy = convention.policy;
    return record;
  }

  function maybeMaterialize(record, phase, context) {
    const convention = conventions.get(record.kind);
    if (!convention || convention.policy !== phase) {
      return undefined;
    }
    return materialize(record, convention, context);
  }

  function materialize(record, convention, context) {
    if (convention.policy === "on-start") {
      const key = context.runtime;
      if (key && record.startMaterialized.has(key)) {
        return record.startMaterialized.get(key);
      }
      const result = runMaterializer(record, convention, context);
      if (key) {
        record.startMaterialized.set(key, result);
      } else {
        record.materialized.set("on-start", result);
      }
      return result;
    }
    const key = convention.policy;
    if (record.materialized.has(key)) {
      return record.materialized.get(key);
    }
    const result = runMaterializer(record, convention, context);
    record.materialized.set(key, result);
    return result;
  }

  function runMaterializer(record, convention, context) {
    const declaration = {
      kind: record.kind,
      id: record.id,
      value: record.value,
      owner: convention.owner,
      policy: convention.policy
    };
    if (!convention.materialize) {
      return record.value;
    }
    return convention.materialize(declaration, {
      ...context,
      declarations: bus,
      registry: context.registry,
      app: context.app,
      runtime: context.runtime
    });
  }

  function readStartCache(record, context) {
    if (context.runtime && record.startMaterialized.has(context.runtime)) {
      return record.startMaterialized.get(context.runtime);
    }
    return record.materialized.get("on-start");
  }

  function handleDuplicate(scope, key, message) {
    const policy = duplicatePolicies[scope] ?? duplicatePolicyDefaults[scope] ?? "warn";
    const collision = { scope, key, policy, message };
    collisions.push(collision);
    if (policy === "strict") {
      throw new Error(message);
    }
    if (policy === "warn") {
      console.warn?.(`[async/use] ${message}`);
    }
    return collision;
  }
}

export function normalizeDuplicatePolicies(source = {}, base = duplicatePolicyDefaults) {
  const normalized = { ...duplicatePolicyDefaults, ...base };
  for (const [scope, policy] of Object.entries(source ?? {})) {
    if (!Object.hasOwn(duplicatePolicyDefaults, scope)) {
      throw new Error(`Unknown Async duplicate policy scope "${scope}".`);
    }
    if (!duplicatePolicyNames.has(policy)) {
      throw new Error(`Duplicate policy for "${scope}" must be "warn", "strict", or "ignore".`);
    }
    normalized[scope] = policy;
  }
  return normalized;
}

function normalizeConvention(kind, convention = {}) {
  const policy = convention.policy ?? "on-register";
  if (!materializationPolicies.has(policy)) {
    throw new Error(`Convention "${kind}" policy must be "on-register", "on-start", or "on-demand".`);
  }
  return {
    kind,
    owner: normalizeOwner(convention.owner ?? convention.capability ?? kind),
    policy,
    materialize: convention.materialize
  };
}

function normalizeModules(modules) {
  if (Array.isArray(modules)) {
    return modules.map((moduleDefinition) => [moduleDefinition?.id, moduleDefinition]);
  }
  if (isModuleDefinition(modules)) {
    return [[modules.id, modules]];
  }
  return Object.entries(modules ?? {});
}

function normalizeModule(moduleDefinition = {}, fallbackId) {
  if (!moduleDefinition || typeof moduleDefinition !== "object") {
    throw new TypeError("Async module definitions must be objects.");
  }
  const owner = normalizeOwner(moduleDefinition.owner ?? moduleDefinition.system ?? moduleDefinition.id ?? fallbackId);
  const id = moduleDefinition.id ?? fallbackId ?? owner.id;
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("Async module definitions require an id.");
  }
  if (moduleDefinition.install !== undefined && typeof moduleDefinition.install !== "function") {
    throw new TypeError(`Module "${id}" install must be a function.`);
  }
  return {
    id,
    owner,
    key: owner.key,
    install: moduleDefinition.install
  };
}

function isModuleDefinition(value) {
  return Boolean(value && typeof value === "object" && (
    Object.hasOwn(value, "install")
    || Object.hasOwn(value, "owner")
    || Object.hasOwn(value, "system")
    || Object.hasOwn(value, "id")
  ));
}

function normalizeOwner(value) {
  if (value?.[systemBrand]) {
    return value;
  }
  if (typeof value === "symbol") {
    return Object.freeze({
      id: value.description ?? String(value),
      key: value,
      [systemBrand]: true
    });
  }
  if (typeof value === "string" && value.length > 0) {
    return system.for(value);
  }
  throw new TypeError("Async convention owners require system.for(id) or a non-empty id string.");
}

function publicConvention(convention) {
  return {
    owner: convention.owner.id,
    policy: convention.policy
  };
}

function materializedPhases(record) {
  const phases = [...record.materialized.keys()];
  if (record.policy === "on-start" && phases.length === 0) {
    return [];
  }
  return phases;
}

function assertKind(kind) {
  if (typeof kind !== "string" || kind.length === 0) {
    throw new TypeError("Declaration kind must be a non-empty string.");
  }
}

function assertId(kind, id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError(`${kind} id must be a non-empty string.`);
  }
}
