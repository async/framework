import {
  _ as h,
  a as k,
  b as j,
  g,
  l as P,
  p as y,
  s as m,
  u as S,
} from "./q-DwB5CxdB.js";
import {
  _hW as p,
  j as K,
  l as O,
  p as D,
  q as d,
  r as f,
  S as x,
  s as q,
} from "./q-BjteJSFI.js";
const $ = (s, e) => {
    var t;
    if (!((t = navigator.connection) != null && t.saveData) && e && e.href) {
      const o = new URL(e.href);
      y(o.pathname),
        e.hasAttribute("data-prefetch") &&
        P(o, e, { prefetchSymbols: !1, isPrefetch: !0 });
    }
  },
  C = Object.freeze(
    Object.defineProperty(
      { __proto__: null, _hW: p, s_xY1vH3M9fB4: $ },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  T = (s) => {
    const e = S(),
      t = k(),
      {
        onClick$: o,
        prefetch: n,
        reload: c,
        replaceState: u,
        scroll: v,
        ...r
      } = s,
      a = f(() => g({ ...r, reload: c }, t));
    r.href = a || s.href;
    const _ = f(() => !!a && n !== !1 && n !== "js" && m(a, t) || void 0),
      i = f(() => _ || !!a && n !== !1 && j(a, t))
        ? d(
          () => h(() => Promise.resolve().then(() => C), void 0),
          "s_xY1vH3M9fB4",
        )
        : void 0,
      b = a
        ? q(
          (l, L) => {
            l.metaKey || l.ctrlKey || l.shiftKey || l.altKey ||
              l.preventDefault();
          },
          "(event,target)=>{if(!(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)){event.preventDefault();}}",
        )
        : void 0;
    return K(
      "a",
      {
        "q:link": !!a,
        ...r,
        "data-prefetch": _,
        children: O(x, null, 3, "P4_5"),
        onClick$: [
          b,
          o,
          a
            ? d(
              () => h(() => Promise.resolve().then(() => E), void 0),
              "s_fqdrEYGKbO8",
              [e, c, u, v],
            )
            : void 0,
        ],
        onMouseOver$: [r.onMouseOver$, i],
        onFocus$: [r.onFocus$, i],
        onQVisible$: [r.onQVisible$, i],
      },
      null,
      0,
      "P4_6",
    );
  },
  A = async (s, e) => {
    const [t, o, n, c] = D();
    s.defaultPrevented &&
      (e.hasAttribute("q:nbs")
        ? await t(location.href, { type: "popstate" })
        : e.href &&
          (e.setAttribute("aria-pressed", "true"),
            await t(e.href, { forceReload: o, replaceState: n, scroll: c }),
            e.removeAttribute("aria-pressed")));
  },
  E = Object.freeze(
    Object.defineProperty(
      { __proto__: null, _hW: p, s_fqdrEYGKbO8: A },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  );
export { $ as s_xY1vH3M9fB4, A as a, p as _hW, T as s };
