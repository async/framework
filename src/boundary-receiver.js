import { normalizeAttributeConfig, readAttribute } from "./attributes.js";
import { renderTemplate } from "./html.js";

const defaultRecentLimit = 50;
const builtBackpatchAttribute = "data-async-backpatch";
const pendingTargetAttribute = "data-pending-id";
const revealOrders = new Set(["as-ready", "forwards", "backwards", "together"]);
const revealTails = new Set(["collapsed", "hidden"]);
const structuralAttributeNames = new Set(["innerhtml", "outerhtml", "textcontent", "children", "childnodes"]);

export const AsyncStream = Object.freeze({
  applyScript,
  applyCurrentScript
});

export function createBoundaryReceiver(options = {}) {
  const loader = options.loader;
  const signals = options.signals ?? loader?.signals;
  const cache = options.cache ?? loader?.cache;
  const scheduler = options.scheduler ?? loader?.scheduler;
  const router = options.router ?? loader?.router;
  const attributes = normalizeAttributeConfig(options.attributes ?? loader?.attributes);
  const recentLimit = options.recentLimit ?? defaultRecentLimit;
  const throwOnError = options.throwOnError === true;
  const onApply = typeof options.onApply === "function" ? options.onApply : undefined;
  const onIgnore = typeof options.onIgnore === "function" ? options.onIgnore : undefined;
  const onError = typeof options.onError === "function" ? options.onError : undefined;
  const isScopeDestroyed = typeof options.isScopeDestroyed === "function"
    ? options.isScopeDestroyed
    : (scope) => scheduler?.isScopeDestroyed?.(scope) ?? scheduler?.inspectDestroyed?.(scope) ?? false;

  if (!loader || typeof loader.swap !== "function") {
    throw new TypeError("createBoundaryReceiver(...) requires a loader with swap(boundary, html).");
  }
  if (!Number.isInteger(recentLimit) || recentLimit < 0) {
    throw new TypeError("createBoundaryReceiver(...) recentLimit must be a non-negative integer.");
  }

  const boundaries = new Map();
  const revealGroups = new Map();
  const recent = [];
  let destroyed = false;

  const receiver = {
    async apply(patch) {
      if (destroyed) {
        throw new Error("Boundary receiver has been destroyed.");
      }

      const normalized = validatePatch(patch);
      const record = boundaryRecord(normalized.boundary);
      let releasePending;
      const previousPending = record.pending ?? Promise.resolve();
      const pending = new Promise((resolve) => {
        releasePending = resolve;
      });
      record.pending = pending;

      try {
        await previousPending;
        if (destroyed) {
          throw new Error("Boundary receiver has been destroyed.");
        }
        return await applyBoundaryPatch(record, normalized, patch);
      } finally {
        releasePending();
        if (record.pending === pending) {
          record.pending = undefined;
        }
      }
    },

    inspect() {
      const snapshot = {};
      for (const [boundary, record] of boundaries) {
        snapshot[boundary] = {
          lastSeq: record.lastSeq,
          applied: record.applied,
          ignored: record.ignored,
          lastStatus: record.lastStatus
        };
        if (record.errored > 0) {
          snapshot[boundary].errored = record.errored;
        }
      }
      return {
        destroyed,
        boundaries: snapshot,
        reveal: inspectRevealGroups(revealGroups),
        recent: recent.map((entry) => ({ ...entry }))
      };
    },

    reset(boundary) {
      if (boundary === undefined) {
        boundaries.clear();
        revealGroups.clear();
        recent.length = 0;
        return receiver;
      }
      assertBoundary(boundary);
      boundaries.delete(boundary);
      for (let index = recent.length - 1; index >= 0; index -= 1) {
        if (recent[index].boundary === boundary) {
          recent.splice(index, 1);
        }
      }
      for (const group of revealGroups.values()) {
        for (const [index, item] of group.pending) {
          if (item.normalized.boundary === boundary) {
            group.pending.delete(index);
          }
        }
      }
      return receiver;
    },

    destroy() {
      destroyed = true;
      boundaries.clear();
      revealGroups.clear();
      recent.length = 0;
    }
  };

  return receiver;

  async function applyBoundaryPatch(record, normalized, patch) {
    const ignored = preflightIgnoredResult(record, normalized);
    if (ignored) {
      rememberIgnored(record, ignored, patch);
      return ignored;
    }

    if (Object.hasOwn(normalized, "error")) {
      const error = toStableError(normalized.error);
      const result = {
        status: "errored",
        boundary: normalized.boundary,
        seq: normalized.seq,
        error
      };
      record.lastSeq = normalized.seq;
      record.errored += 1;
      record.lastStatus = result.status;
      remember(result);
      onError?.(error, result, patch);
      if (throwOnError) {
        throw error;
      }
      return result;
    }

    applyStateEffects(normalized);

    if (normalized.reveal) {
      return await applyRevealPatch(record, normalized, patch);
    }

    return await commitBoundaryPatch(record, normalized, patch, { stateApplied: true });
  }

  async function applyRevealPatch(record, normalized, patch) {
    const group = revealGroup(normalized.reveal);
    const index = normalized.reveal.index;
    if (group.committed.has(index)) {
      throw new TypeError(`Reveal group "${group.id}" already committed index ${index}.`);
    }
    if (group.pending.has(index)) {
      throw new TypeError(`Reveal group "${group.id}" already has a pending patch for index ${index}.`);
    }

    const item = { record, normalized, patch };
    group.pending.set(index, item);
    const ready = takeReadyRevealItems(group);
    if (!ready.includes(item)) {
      const result = {
        status: "buffered",
        boundary: normalized.boundary,
        seq: normalized.seq,
        reveal: revealResultMetadata(normalized.reveal)
      };
      record.lastStatus = result.status;
      remember(result);
      updateRevealTail(group);
      return result;
    }

    let currentResult;
    for (const readyItem of ready) {
      const result = await commitBoundaryPatch(readyItem.record, readyItem.normalized, readyItem.patch, {
        stateApplied: true
      });
      group.committed.add(readyItem.normalized.reveal.index);
      if (readyItem === item) {
        currentResult = result;
      }
    }
    updateRevealTail(group);
    return currentResult;
  }

  async function commitBoundaryPatch(record, normalized, patch, options = {}) {
    const ignored = preflightIgnoredResult(record, normalized);
    if (ignored) {
      rememberIgnored(record, ignored, patch);
      return ignored;
    }

    if (!options.stateApplied) {
      applyStateEffects(normalized);
    }

    let boundaryElement;
    let replacementCount = 0;
    if (normalized.html != null) {
      boundaryElement = loader.swap(normalized.boundary, normalized.html);
    }
    if (normalized.replace) {
      boundaryElement ??= findBoundaryElement(loader.root, normalized.boundary, attributes);
      replacementCount = applyReplacements(boundaryElement, normalized.replace);
    }

    let attrs;
    if (normalized.attrs) {
      boundaryElement ??= findBoundaryElement(loader.root, normalized.boundary, attributes);
      attrs = applyAttributePatches(boundaryElement, normalized.attrs);
    }

    await flushScheduler(scheduler, normalized.scope);

    if (normalized.redirect) {
      const result = withPatchMetadata({
        status: "redirected",
        boundary: normalized.boundary,
        seq: normalized.seq,
        redirect: normalized.redirect
      }, attrs, replacementCount);
      await followRedirect(normalized.redirect, router, loader);
      record.applied += 1;
      record.lastSeq = normalized.seq;
      record.lastStatus = result.status;
      remember(result);
      onApply?.(result, patch);
      return result;
    }

    const result = withPatchMetadata({
      status: "applied",
      boundary: normalized.boundary,
      seq: normalized.seq
    }, attrs, replacementCount);
    record.applied += 1;
    record.lastSeq = normalized.seq;
    record.lastStatus = result.status;
    remember(result);
    onApply?.(result, patch);
    return result;
  }

  function applyStateEffects(normalized) {
    if (normalized.signals) {
      if (!signals || typeof signals.set !== "function") {
        throw new Error("Boundary patch includes signals, but no signal registry is available.");
      }
      for (const [path, value] of Object.entries(normalized.signals)) {
        signals.set(path, value);
      }
    }

    if (normalized.cache?.browser) {
      if (!cache || typeof cache.restore !== "function") {
        throw new Error("Boundary patch includes browser cache, but no cache registry is available.");
      }
      cache.restore(normalized.cache.browser);
    }
  }

  function applyReplacements(boundaryElement, replacements) {
    let applied = 0;
    for (const replacement of replacements) {
      if (replacement.mode === "boundary") {
        const target = findBoundaryElement(loader.root, replacement.target, attributes);
        if (!containsOrEquals(boundaryElement, target)) {
          throw new Error(`Boundary replacement target "${replacement.target}" is outside boundary "${boundaryIdFor(boundaryElement, attributes)}".`);
        }
        loader.swap(replacement.target, replacement.html);
        applied += 1;
        continue;
      }

      const target = findUniqueScopedElement(
        boundaryElement,
        (element) => element.getAttribute?.(pendingTargetAttribute) === replacement.target,
        `Pending replacement target "${replacement.target}"`
      );
      const fragment = toFragment(replacement.html, ownerDocumentOf(boundaryElement));
      const inserted = [...fragment.childNodes];
      target.replaceWith(fragment);
      for (const node of inserted) {
        if (node.nodeType === 1 || node.nodeType === 11) {
          loader.scan?.(node);
        }
      }
      applied += 1;
    }
    return applied;
  }

  function applyAttributePatches(boundaryElement, attrs) {
    let applied = 0;
    for (const attr of attrs.items) {
      const target = attrs.kind === "built"
        ? resolveBuiltAttrTarget(boundaryElement, attr.target)
        : resolveNamedAttrTarget(boundaryElement, attr.target);
      setPatchedAttribute(target, attr.name, attr.value);
      applied += 1;
    }
    return {
      applied,
      ignored: 0
    };
  }

  function resolveBuiltAttrTarget(boundaryElement, targetIndex) {
    const targets = scopedElements(boundaryElement)
      .filter((element) => element.hasAttribute?.(builtBackpatchAttribute));
    const target = targets[targetIndex];
    if (!target) {
      throw new Error(`Built attribute patch target ${targetIndex} was not found in boundary "${boundaryIdFor(boundaryElement, attributes)}".`);
    }
    return target;
  }

  function resolveNamedAttrTarget(boundaryElement, targetName) {
    return findUniqueScopedElement(
      boundaryElement,
      (element) => readAttribute(element, attributes, "async", "patch") === targetName,
      `Attribute patch target "${targetName}"`
    );
  }

  function findUniqueScopedElement(boundaryElement, predicate, label) {
    const matches = scopedElements(boundaryElement).filter(predicate);
    if (matches.length === 0) {
      throw new Error(`${label} was not found.`);
    }
    if (matches.length > 1) {
      throw new Error(`${label} is ambiguous.`);
    }
    return matches[0];
  }

  function scopedElements(boundaryElement) {
    return elementsIn(boundaryElement)
      .filter((element) => !isNestedBoundaryElement(element, boundaryElement, attributes));
  }

  function revealGroup(reveal) {
    const existing = revealGroups.get(reveal.group);
    if (existing) {
      if (existing.count !== reveal.count || existing.order !== reveal.order || existing.tail !== reveal.tail) {
        throw new TypeError(`Reveal group "${reveal.group}" metadata does not match earlier patches.`);
      }
      return existing;
    }

    const group = {
      id: reveal.group,
      count: reveal.count,
      order: reveal.order,
      tail: reveal.tail,
      pending: new Map(),
      committed: new Set(),
      nextForward: 0,
      nextBackward: reveal.count - 1
    };
    revealGroups.set(reveal.group, group);
    return group;
  }

  function updateRevealTail(group) {
    if (!group.tail) {
      return;
    }
    const container = findRevealContainer(loader.root, group.id, attributes);
    if (!container) {
      return;
    }
    const children = directChildBoundaryElements(container, attributes).slice(0, group.count);
    if (children.length === 0) {
      return;
    }

    const pending = [];
    for (let index = 0; index < children.length; index += 1) {
      if (!group.committed.has(index)) {
        pending.push(index);
      } else {
        setTailHidden(children[index], false);
      }
    }

    const visiblePending = group.tail === "collapsed" && pending.length > 0
      ? pendingOrderFor(group, pending)[0]
      : undefined;
    for (const index of pending) {
      setTailHidden(children[index], group.tail === "hidden" || index !== visiblePending);
    }
  }

  function boundaryRecord(boundary) {
    if (!boundaries.has(boundary)) {
      boundaries.set(boundary, {
        lastSeq: -Infinity,
        applied: 0,
        ignored: 0,
        errored: 0,
        lastStatus: undefined,
        pending: undefined
      });
    }
    return boundaries.get(boundary);
  }

  function preflightIgnoredResult(record, normalized) {
    if (normalized.seq <= record.lastSeq) {
      return {
        status: "ignored-stale",
        boundary: normalized.boundary,
        seq: normalized.seq,
        lastSeq: record.lastSeq
      };
    }

    if (normalized.parentScope !== undefined && isScopeDestroyed(normalized.parentScope)) {
      return {
        status: "ignored-destroyed",
        boundary: normalized.boundary,
        seq: normalized.seq,
        parentScope: normalized.parentScope
      };
    }
    return null;
  }

  function rememberIgnored(record, result, patch) {
    record.ignored += 1;
    record.lastStatus = result.status;
    remember(result);
    onIgnore?.(result, patch);
  }

  function remember(result) {
    if (recentLimit === 0) {
      return;
    }
    recent.push(toRecentEntry(result));
    while (recent.length > recentLimit) {
      recent.shift();
    }
  }
}

function applyScript(script, options = {}) {
  if (!script || typeof script !== "object" || typeof script.textContent !== "string") {
    throw new TypeError("AsyncStream.applyScript(script) requires a JSON script element.");
  }
  const attributes = normalizeAttributeConfig(options.attributes ?? options.receiver?.attributes);
  const patch = parseStreamPatch(script.textContent);
  const root = options.root ?? script.ownerDocument ?? globalThis.document;
  const resolved = resolveStreamPatch(patch, { root, attributes });
  const receiver = resolveReceiver(options);
  return receiver.apply(resolved);
}

function applyCurrentScript(scriptOrOptions, maybeOptions) {
  const script = isElementLike(scriptOrOptions)
    ? scriptOrOptions
    : globalThis.document?.currentScript;
  const options = isElementLike(scriptOrOptions) ? maybeOptions ?? {} : scriptOrOptions ?? {};
  return applyScript(script, options);
}

function resolveReceiver(options = {}) {
  if (options.receiver && typeof options.receiver.apply === "function") {
    return options.receiver;
  }
  const runtime = options.runtime ?? globalThis.Async?.runtime;
  const loader = options.loader ?? runtime?.loader;
  if (!loader) {
    throw new TypeError("AsyncStream requires receiver, loader, or runtime.loader.");
  }
  return createBoundaryReceiver({
    loader,
    signals: options.signals ?? runtime?.signals,
    cache: options.cache ?? runtime?.browser?.cache,
    scheduler: options.scheduler ?? runtime?.scheduler,
    router: options.router ?? runtime?.router,
    attributes: options.attributes ?? runtime?.attributes ?? loader.attributes
  });
}

function parseStreamPatch(source) {
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new TypeError(`Async stream patch JSON is invalid: ${error.message}`);
  }
}

function resolveStreamPatch(patch, { root, attributes }) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new TypeError("Async stream patch JSON must be an object.");
  }
  const resolved = { ...patch };
  if (patch.replace !== undefined) {
    resolved.replace = resolveStreamReplacements(patch.replace, root, attributes);
  }
  const synthesizedReveal = synthesizeRevealMetadata(resolved, root, attributes);
  if (patch.reveal !== undefined && synthesizedReveal && !sameRevealMetadata(patch.reveal, synthesizedReveal)) {
    throw new TypeError("Explicit stream reveal metadata conflicts with DOM reveal metadata.");
  }
  if (patch.reveal === undefined && synthesizedReveal) {
    resolved.reveal = synthesizedReveal;
  }
  return resolved;
}

function resolveStreamReplacements(value, root, attributes) {
  const replacements = Array.isArray(value) ? value : [value];
  return replacements.map((replacement) => {
    if (!isPlainObject(replacement)) {
      throw new TypeError("Stream replacement records must be objects.");
    }
    if (replacement.template === undefined || Object.hasOwn(replacement, "html")) {
      return replacement;
    }
    const template = findStreamTemplate(root, replacement.template, attributes);
    if (!template) {
      throw new Error(`Stream template "${replacement.template}" was not found.`);
    }
    return {
      ...replacement,
      html: template.innerHTML
    };
  });
}

function findStreamTemplate(root, id, attributes) {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("Stream replacement template must be a non-empty string.");
  }
  return elementsIn(root)
    .find((element) => element.tagName === "TEMPLATE" && readAttribute(element, attributes, "async", "stream-template") === id)
    ?? null;
}

function synthesizeRevealMetadata(patch, root, attributes) {
  if (typeof patch.boundary !== "string" || patch.boundary.length === 0) {
    return null;
  }
  const boundary = findBoundaryElement(root, patch.boundary, attributes, { required: false });
  const container = boundary?.parentElement;
  const group = container ? readAttribute(container, attributes, "async", "reveal") : null;
  if (!group) {
    return null;
  }
  const children = directChildBoundaryElements(container, attributes);
  const index = children.indexOf(boundary);
  if (index === -1) {
    return null;
  }
  return {
    group,
    index,
    count: children.length,
    order: readAttribute(container, attributes, "async", "reveal-order") || "as-ready",
    tail: readAttribute(container, attributes, "async", "reveal-tail") || undefined
  };
}

function sameRevealMetadata(left, right) {
  return left?.group === right.group &&
    left?.index === right.index &&
    left?.count === right.count &&
    (left?.order ?? "as-ready") === right.order &&
    left?.tail === right.tail;
}

function validatePatch(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new TypeError("receiver.apply(patch) requires a boundary patch object.");
  }

  assertBoundary(patch.boundary);
  if (typeof patch.seq !== "number" || !Number.isFinite(patch.seq)) {
    throw new TypeError("Boundary patch seq must be a finite number.");
  }

  if (patch.signals !== undefined && !isPlainObject(patch.signals)) {
    throw new TypeError("Boundary patch signals must be an object.");
  }
  if (patch.cache !== undefined && !isPlainObject(patch.cache)) {
    throw new TypeError("Boundary patch cache must be an object.");
  }
  if (patch.cache?.browser !== undefined && !isPlainObject(patch.cache.browser)) {
    throw new TypeError("Boundary patch cache.browser must be an object.");
  }
  if (patch.redirect !== undefined && (typeof patch.redirect !== "string" || patch.redirect.length === 0)) {
    throw new TypeError("Boundary patch redirect must be a non-empty string.");
  }
  if (patch.parentScope !== undefined && typeof patch.parentScope !== "string") {
    throw new TypeError("Boundary patch parentScope must be a string.");
  }
  if (patch.scope !== undefined && typeof patch.scope !== "string") {
    throw new TypeError("Boundary patch scope must be a string.");
  }

  const normalized = { ...patch };
  if (patch.attrs !== undefined) {
    normalized.attrs = normalizeAttributePatches(patch.attrs);
  }
  if (patch.replace !== undefined) {
    normalized.replace = normalizeReplacements(patch.replace);
  }
  if (patch.reveal !== undefined) {
    normalized.reveal = normalizeRevealMetadata(patch.reveal);
  }

  const hasHtml = Object.hasOwn(patch, "html") && patch.html != null;
  const hasSignals = patch.signals && Object.keys(patch.signals).length > 0;
  const hasBrowserCache = patch.cache?.browser && Object.keys(patch.cache.browser).length > 0;
  const hasRedirect = Boolean(patch.redirect);
  const hasError = Object.hasOwn(patch, "error");
  const hasAttrs = normalized.attrs?.items.length > 0;
  const hasReplace = normalized.replace?.length > 0;
  if (!hasHtml && !hasSignals && !hasBrowserCache && !hasRedirect && !hasError && !hasAttrs && !hasReplace) {
    throw new TypeError("Boundary patch must include html, replace, attrs, signals, cache.browser, redirect, or error.");
  }

  return normalized;
}

function normalizeAttributePatches(attrs) {
  if (!Array.isArray(attrs)) {
    throw new TypeError("Boundary patch attrs must be an array.");
  }
  if (attrs.length === 0) {
    return { kind: "built", items: [] };
  }
  const named = Array.isArray(attrs[0]);
  if (named) {
    return {
      kind: "named",
      items: attrs.map((tuple) => normalizeNamedAttributePatch(tuple))
    };
  }
  if (attrs.some(Array.isArray)) {
    throw new TypeError("Boundary patch attrs cannot mix built triples and no-build tuples.");
  }
  if (attrs.length % 3 !== 0) {
    throw new TypeError("Built attribute patch triples must have a length divisible by 3.");
  }
  const items = [];
  for (let index = 0; index < attrs.length; index += 3) {
    const target = attrs[index];
    const name = attrs[index + 1];
    const value = attrs[index + 2];
    assertBuiltTarget(target);
    assertAttributeName(name);
    assertAttributeValue(value);
    items.push({ target, name, value });
  }
  return { kind: "built", items };
}

function normalizeNamedAttributePatch(tuple) {
  if (!Array.isArray(tuple) || tuple.length !== 3) {
    throw new TypeError("No-build attribute patches must be [targetName, attrName, value] tuples.");
  }
  const [target, name, value] = tuple;
  if (typeof target !== "string" || target.length === 0) {
    throw new TypeError("No-build attribute patch target names must be non-empty strings.");
  }
  assertAttributeName(name);
  assertAttributeValue(value);
  return { target, name, value };
}

function normalizeReplacements(value) {
  const replacements = Array.isArray(value) ? value : [value];
  return replacements.map((replacement) => {
    if (!isPlainObject(replacement)) {
      throw new TypeError("Boundary patch replace records must be objects.");
    }
    if (typeof replacement.target !== "string" || replacement.target.length === 0) {
      throw new TypeError("Boundary patch replace target must be a non-empty string.");
    }
    if (replacement.mode !== undefined && replacement.mode !== "pending" && replacement.mode !== "boundary") {
      throw new TypeError("Boundary patch replace mode must be \"pending\" or \"boundary\".");
    }
    if (!Object.hasOwn(replacement, "html") || replacement.html == null) {
      throw new TypeError("Boundary patch replace records must include html.");
    }
    return {
      target: replacement.target,
      html: replacement.html,
      mode: replacement.mode ?? "pending"
    };
  });
}

function normalizeRevealMetadata(reveal) {
  if (!isPlainObject(reveal)) {
    throw new TypeError("Boundary patch reveal metadata must be an object.");
  }
  const order = reveal.order ?? "as-ready";
  if (typeof reveal.group !== "string" || reveal.group.length === 0) {
    throw new TypeError("Reveal group must be a non-empty string.");
  }
  if (!Number.isInteger(reveal.count) || reveal.count < 1) {
    throw new TypeError("Reveal count must be a positive integer.");
  }
  if (!Number.isInteger(reveal.index) || reveal.index < 0 || reveal.index >= reveal.count) {
    throw new TypeError("Reveal index must be an integer from 0 to count - 1.");
  }
  if (!revealOrders.has(order)) {
    throw new TypeError("Reveal order must be as-ready, forwards, backwards, or together.");
  }
  if (reveal.tail !== undefined && !revealTails.has(reveal.tail)) {
    throw new TypeError("Reveal tail must be collapsed or hidden.");
  }
  return {
    group: reveal.group,
    index: reveal.index,
    count: reveal.count,
    order,
    tail: reveal.tail
  };
}

function assertBoundary(boundary) {
  if (typeof boundary !== "string" || boundary.length === 0) {
    throw new TypeError("Boundary patch boundary must be a non-empty string.");
  }
}

function assertBuiltTarget(target) {
  if (!Number.isInteger(target) || target < 0) {
    throw new TypeError("Built attribute patch target indexes must be non-negative integers.");
  }
}

function assertAttributeName(name) {
  if (typeof name !== "string" || name.length === 0) {
    throw new TypeError("Attribute patch names must be non-empty strings.");
  }
  const normalized = name.toLowerCase();
  if (
    normalized.startsWith("on") ||
    structuralAttributeNames.has(normalized) ||
    /[\s<>"'=]/.test(name)
  ) {
    throw new TypeError(`Attribute patch name "${name}" is not allowed.`);
  }
}

function assertAttributeValue(value) {
  const type = typeof value;
  if (value != null && type !== "string" && type !== "number" && type !== "boolean") {
    throw new TypeError("Attribute patch values must be strings, numbers, booleans, null, or undefined.");
  }
}

function setPatchedAttribute(element, name, value) {
  if (value === false || value == null) {
    element.removeAttribute(name);
    return;
  }
  element.setAttribute(name, value === true ? "" : String(value));
}

async function flushScheduler(scheduler, scope) {
  if (!scheduler) {
    return;
  }
  if (scope !== undefined && typeof scheduler.flushScope === "function") {
    await scheduler.flushScope(scope);
    return;
  }
  if (typeof scheduler.flush === "function") {
    await scheduler.flush();
  }
}

async function followRedirect(redirect, router, loader) {
  if (router && typeof router.navigate === "function") {
    await router.navigate(redirect);
    return;
  }
  const location = loader?.root?.ownerDocument?.defaultView?.location ?? globalThis.location;
  location?.assign?.(redirect);
}

function takeReadyRevealItems(group) {
  if (group.order === "as-ready") {
    return takePendingIndexes(group, [...group.pending.keys()].sort((left, right) => left - right));
  }
  if (group.order === "forwards") {
    const indexes = [];
    while (group.pending.has(group.nextForward)) {
      indexes.push(group.nextForward);
      group.nextForward += 1;
    }
    return takePendingIndexes(group, indexes);
  }
  if (group.order === "backwards") {
    const indexes = [];
    while (group.pending.has(group.nextBackward)) {
      indexes.push(group.nextBackward);
      group.nextBackward -= 1;
    }
    return takePendingIndexes(group, indexes);
  }
  if (group.committed.size + group.pending.size < group.count) {
    return [];
  }
  const indexes = [];
  for (let index = 0; index < group.count; index += 1) {
    if (group.pending.has(index)) {
      indexes.push(index);
    }
  }
  return takePendingIndexes(group, indexes);
}

function takePendingIndexes(group, indexes) {
  const items = [];
  for (const index of indexes) {
    const item = group.pending.get(index);
    if (item) {
      group.pending.delete(index);
      items.push(item);
    }
  }
  return items;
}

function pendingOrderFor(group, pending) {
  return group.order === "backwards"
    ? pending.slice().sort((left, right) => right - left)
    : pending.slice().sort((left, right) => left - right);
}

function inspectRevealGroups(groups) {
  const inspected = {};
  for (const [id, group] of groups) {
    inspected[id] = {
      count: group.count,
      order: group.order,
      tail: group.tail,
      pending: [...group.pending.keys()].sort((left, right) => left - right),
      committed: [...group.committed].sort((left, right) => left - right)
    };
  }
  return inspected;
}

function revealResultMetadata(reveal) {
  return {
    group: reveal.group,
    index: reveal.index,
    count: reveal.count,
    order: reveal.order,
    tail: reveal.tail
  };
}

function withPatchMetadata(result, attrs, replacementCount) {
  if (attrs) {
    result.attrs = attrs;
  }
  if (replacementCount > 0) {
    result.replace = { applied: replacementCount };
  }
  return result;
}

function toStableError(value) {
  if (value instanceof Error) {
    return value;
  }
  if (value && typeof value === "object" && typeof value.message === "string") {
    return Object.assign(new Error(value.message), value);
  }
  return new Error(String(value));
}

function toRecentEntry(result) {
  const entry = {
    boundary: result.boundary,
    seq: result.seq,
    status: result.status
  };
  if (result.status === "ignored-stale") {
    entry.lastSeq = result.lastSeq;
  }
  if (result.status === "ignored-destroyed" && result.parentScope !== undefined) {
    entry.parentScope = result.parentScope;
  }
  if (result.status === "redirected") {
    entry.redirect = result.redirect;
  }
  if (result.status === "buffered") {
    entry.reveal = result.reveal;
  }
  if (result.attrs) {
    entry.attrs = { ...result.attrs };
  }
  if (result.replace) {
    entry.replace = { ...result.replace };
  }
  return entry;
}

function findBoundaryElement(root, boundaryId, attributes, options = {}) {
  const boundary = elementsIn(root)
    .find((element) => boundaryIdFor(element, attributes) === String(boundaryId));
  if (!boundary && options.required !== false) {
    throw new Error(`Boundary "${boundaryId}" was not found.`);
  }
  return boundary ?? null;
}

function boundaryIdFor(element, attributes) {
  if (element?.tagName === "ASYNC-SUSPENSE" && element.hasAttribute?.("for")) {
    return element.getAttribute("for");
  }
  return readAttribute(element, attributes, "async", "boundary");
}

function directChildBoundaryElements(container, attributes) {
  return [...(container?.children ?? [])]
    .filter((element) => boundaryIdFor(element, attributes) != null);
}

function findRevealContainer(root, group, attributes) {
  return elementsIn(root)
    .find((element) => readAttribute(element, attributes, "async", "reveal") === group)
    ?? null;
}

function isNestedBoundaryElement(element, boundaryElement, attributes) {
  if (element === boundaryElement) {
    return false;
  }
  if (boundaryIdFor(element, attributes) != null) {
    return true;
  }
  let parent = element.parentElement;
  while (parent && parent !== boundaryElement) {
    if (boundaryIdFor(parent, attributes) != null) {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

function setTailHidden(element, hidden) {
  if (hidden) {
    element.setAttribute("hidden", "");
    if ("hidden" in element) {
      element.hidden = true;
    }
    return;
  }
  element.removeAttribute("hidden");
  if ("hidden" in element) {
    element.hidden = false;
  }
}

function containsOrEquals(parent, child) {
  return parent === child || parent.contains?.(child);
}

function ownerDocumentOf(element) {
  return element.ownerDocument ?? globalThis.document;
}

function toFragment(value, documentRef) {
  if (value?.nodeType === 11) {
    return value.cloneNode(true);
  }
  if (value?.tagName === "TEMPLATE") {
    return value.content.cloneNode(true);
  }
  if (value?.nodeType) {
    const fragment = documentRef.createDocumentFragment();
    fragment.append(value.cloneNode(true));
    return fragment;
  }
  const template = documentRef.createElement("template");
  template.innerHTML = typeof value === "string" ? value : renderTemplate(value);
  return template.content.cloneNode(true);
}

function elementsIn(scope) {
  const elements = [];
  if (scope?.nodeType === 1) {
    elements.push(scope);
  }
  elements.push(...(scope?.querySelectorAll?.("*") ?? []));
  return elements;
}

function isElementLike(value) {
  return Boolean(value?.nodeType === 1 && typeof value.textContent === "string");
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
