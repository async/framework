import { effect } from "./signals-lite.ts";

export const Fragment = Symbol("Fragment");

export type RenderPrimitive = string | number | boolean | null | undefined;
export type VNodeChild = VNode | RenderPrimitive | VNodeChild[];

export type VNode = {
  type: string | typeof Fragment;
  props: Record<string, unknown>;
  children: VNode[];
  text?: string;
};

export type Component<Props = Record<string, unknown>> = (
  props: Props & { children?: VNodeChild[] },
) => VNodeChild;

const TEXT = "#text";

function toArray(children: VNodeChild[]): VNodeChild[] {
  return children.flatMap((child) => Array.isArray(child) ? toArray(child) : [child]);
}

function normalize(child: VNodeChild): VNode | null {
  if (child === null || child === undefined || child === false) return null;

  if (typeof child === "string" || typeof child === "number" || typeof child === "boolean") {
    return { type: TEXT, props: {}, children: [], text: String(child) };
  }

  if (Array.isArray(child)) {
    return {
      type: Fragment,
      props: {},
      children: toArray(child).map(normalize).filter(Boolean) as VNode[],
    };
  }

  return child as VNode;
}

export function jsx(
  type: string | typeof Fragment | Component,
  props: Record<string, unknown> | null,
  ...children: VNodeChild[]
): VNode {
  const allProps = props ?? {};
  const normalizedChildren = toArray([
    ...(Array.isArray(allProps.children) ? allProps.children as VNodeChild[] : allProps.children !== undefined ? [allProps.children as VNodeChild] : []),
    ...children,
  ]).map(normalize).filter(Boolean) as VNode[];

  if (typeof type === "function") {
    const rendered = type({ ...allProps, children: normalizedChildren });
    return normalize(rendered) ?? { type: Fragment, props: {}, children: [] };
  }

  return {
    type,
    props: allProps,
    children: normalizedChildren,
  };
}

export const jsxs = jsx;
export const jsxDEV = jsx;

function isChanged(a: VNode | null, b: VNode | null) {
  if (!a || !b) return true;
  return a.type !== b.type;
}

function setProp(el: Element, key: string, value: unknown) {
  if (key === "children") return;
  if (key === "className") {
    el.setAttribute("class", String(value));
    return;
  }
  if (value === false || value === null || value === undefined) {
    el.removeAttribute(key);
    return;
  }
  el.setAttribute(key, String(value));
}

function updateProps(el: Element, oldProps: Record<string, unknown>, newProps: Record<string, unknown>) {
  const keys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);
  keys.forEach((key) => {
    const oldValue = oldProps[key];
    const newValue = newProps[key];
    if (oldValue === newValue) return;
    setProp(el, key, newValue);
  });
}

function createNode(vnode: VNode): Node {
  if (vnode.type === TEXT) {
    return document.createTextNode(vnode.text ?? "");
  }

  if (vnode.type === Fragment) {
    const fragment = document.createDocumentFragment();
    vnode.children.forEach((child) => fragment.appendChild(createNode(child)));
    return fragment;
  }

  const el = document.createElement(vnode.type);
  Object.entries(vnode.props).forEach(([key, value]) => setProp(el, key, value));
  vnode.children.forEach((child) => el.appendChild(createNode(child)));
  return el;
}

function patch(parent: Node, oldNode: Node | null, oldVNode: VNode | null, newVNode: VNode | null): Node | null {
  if (!oldVNode && newVNode) {
    const newNode = createNode(newVNode);
    parent.appendChild(newNode);
    return newNode;
  }

  if (oldVNode && !newVNode && oldNode) {
    parent.removeChild(oldNode);
    return null;
  }

  if (!oldVNode || !newVNode || !oldNode) return oldNode;

  if (isChanged(oldVNode, newVNode)) {
    const replacement = createNode(newVNode);
    parent.replaceChild(replacement, oldNode);
    return replacement;
  }

  if (newVNode.type === TEXT && oldNode.nodeType === Node.TEXT_NODE) {
    if (oldNode.textContent !== newVNode.text) {
      oldNode.textContent = newVNode.text ?? "";
    }
    return oldNode;
  }

  if (newVNode.type === Fragment) {
    const oldChildren = oldVNode.children;
    const newChildren = newVNode.children;
    const childNodes = Array.from(parent.childNodes);
    const limit = Math.max(oldChildren.length, newChildren.length);

    for (let i = 0; i < limit; i++) {
      patch(parent, childNodes[i] ?? null, oldChildren[i] ?? null, newChildren[i] ?? null);
    }
    return oldNode;
  }

  if (oldNode instanceof Element && typeof newVNode.type === "string") {
    updateProps(oldNode, oldVNode.props, newVNode.props);
    const oldChildren = oldVNode.children;
    const newChildren = newVNode.children;
    const childNodes = Array.from(oldNode.childNodes);
    const limit = Math.max(oldChildren.length, newChildren.length);

    for (let i = 0; i < limit; i++) {
      patch(oldNode, childNodes[i] ?? null, oldChildren[i] ?? null, newChildren[i] ?? null);
    }
  }

  return oldNode;
}

function domToVNode(node: Node): VNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return { type: TEXT, props: {}, children: [], text: node.textContent ?? "" };
  }

  if (!(node instanceof Element)) {
    return { type: Fragment, props: {}, children: [] };
  }

  const props: Record<string, unknown> = {};
  for (const attr of Array.from(node.attributes)) {
    props[attr.name] = attr.value;
  }

  return {
    type: node.tagName.toLowerCase(),
    props,
    children: Array.from(node.childNodes).map(domToVNode),
  };
}

export function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<(value: T) => void>();

  return {
    get() {
      return value;
    },
    set(next: T) {
      value = next;
      listeners.forEach((listener) => listener(value));
    },
    update(updater: (current: T) => T) {
      this.set(updater(value));
    },
    subscribe(listener: (value: T) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

type MountOptions = {
  hydrate?: boolean;
};

export function mount(root: Element, view: () => VNode, options: MountOptions = {}) {
  let currentVNode: VNode | null = null;
  let rootNode: Node | null = root.firstChild;

  if (options.hydrate && root.firstChild) {
    currentVNode = domToVNode(root.firstChild);
  }

  const render = () => {
    const nextVNode = view();

    if (!currentVNode && !rootNode) {
      rootNode = createNode(nextVNode);
      root.replaceChildren(rootNode);
    } else {
      rootNode = patch(root, rootNode, currentVNode, nextVNode);
    }

    currentVNode = nextVNode;
  };

  render();
  return { render };
}

export function mountReactive(root: Element, view: () => VNode, options: MountOptions = {}) {
  const mounted = mount(root, view, options);
  const stop = effect(() => {
    mounted.render();
  });

  return {
    dispose: stop,
    render: mounted.render,
  };
}
