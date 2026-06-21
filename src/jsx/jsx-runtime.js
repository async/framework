export const Fragment = Symbol.for("async.framework.jsx.fragment");

export function jsx(type, props, key) {
  return createJsxNode(type, props, key);
}

export function jsxs(type, props, key) {
  return createJsxNode(type, props, key);
}

export function jsxDEV(type, props, key, isStaticChildren, source, self) {
  return createJsxNode(type, props, key, {
    dev: true,
    isStaticChildren,
    source,
    self
  });
}

function createJsxNode(type, props, key, dev) {
  return Object.freeze({
    kind: "async-jsx-node",
    type,
    props: props ?? {},
    key: key ?? null,
    dev: dev ? Object.freeze(dev) : undefined
  });
}

