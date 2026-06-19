export const ASYNC_JSX_SIGNAL = Symbol.for("async.framework.jsx.signal");
export const ASYNC_JSX_COMPONENT = Symbol.for("async.framework.jsx.component");
export const ASYNC_JSX_SUSPENSE = Symbol.for("async.framework.jsx.suspense");
export const ASYNC_JSX_REVEAL = Symbol.for("async.framework.jsx.reveal");

export function signal(source, options = {}) {
  return Object.freeze({
    kind: "async-jsx-signal",
    type: ASYNC_JSX_SIGNAL,
    source,
    options: freezeOptions(options)
  });
}

export function component(render, options = {}) {
  if (typeof render !== "function") {
    throw new TypeError("component(...) expects a render function.");
  }
  return Object.freeze({
    kind: "async-jsx-component",
    type: ASYNC_JSX_COMPONENT,
    render,
    options: freezeOptions(options)
  });
}

export function Suspense(props = {}) {
  return Object.freeze({
    kind: "async-jsx-suspense",
    type: ASYNC_JSX_SUSPENSE,
    props: freezeOptions(props)
  });
}

export function Reveal(props = {}) {
  return Object.freeze({
    kind: "async-jsx-reveal",
    type: ASYNC_JSX_REVEAL,
    props: freezeOptions(props)
  });
}

function freezeOptions(options) {
  if (!options || typeof options !== "object") {
    return {};
  }
  return Object.freeze({ ...options });
}
