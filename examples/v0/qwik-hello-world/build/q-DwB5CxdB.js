import {
  _ as $,
  _hW as H,
  a as ee,
  b as te,
  c as ne,
  d as _,
  e as J,
  f as O,
  g as re,
  h as q,
  i as oe,
  j as D,
  k,
  l as z,
  m as se,
  n as Z,
  o as I,
  p as ie,
  q as m,
  S as ae,
  u as w,
  w as p,
} from "./q-BjteJSFI.js";
const ce = function () {
    const n = typeof document < "u" && document.createElement("link").relList;
    return n && n.supports && n.supports("modulepreload")
      ? "modulepreload"
      : "preload";
  }(),
  le = function (e) {
    return "/" + e;
  },
  L = {},
  g = function (n, t, r) {
    let o = Promise.resolve();
    if (t && t.length > 0) {
      document.getElementsByTagName("link");
      const s = document.querySelector("meta[property=csp-nonce]"),
        a = (s == null ? void 0 : s.nonce) ||
          (s == null ? void 0 : s.getAttribute("nonce"));
      o = Promise.all(t.map((i) => {
        if (i = le(i), i in L) return;
        L[i] = !0;
        const c = i.endsWith(".css"), u = c ? '[rel="stylesheet"]' : "";
        if (document.querySelector(`link[href="${i}"]${u}`)) return;
        const l = document.createElement("link");
        if (
          l.rel = c ? "stylesheet" : ce,
            c || (l.as = "script", l.crossOrigin = ""),
            l.href = i,
            a && l.setAttribute("nonce", a),
            document.head.appendChild(l),
            c
        ) {
          return new Promise((f, d) => {
            l.addEventListener("load", f),
              l.addEventListener(
                "error",
                () => d(new Error(`Unable to preload CSS for ${i}`)),
              );
          });
        }
      }));
    }
    return o.then(() => n()).catch((s) => {
      const a = new Event("vite:preloadError", { cancelable: !0 });
      if (a.payload = s, window.dispatchEvent(a), !a.defaultPrevented) throw s;
    });
  },
  ue =
    '((i,r,a,o)=>{a=e=>{const t=document.querySelector("[q\\\\:base]");t&&r.active&&r.active.postMessage({type:"qprefetch",base:t.getAttribute("q:base"),...e})},document.addEventListener("qprefetch",e=>{const t=e.detail;r?a(t):i.push(t)}),"serviceWorker"in navigator?navigator.serviceWorker.register("/service-worker.js").then(e=>{o=()=>{r=e,i.forEach(a),a({bundles:i})},e.installing?e.installing.addEventListener("statechange",t=>{t.target.state=="activated"&&o()}):e.active&&o()}).catch(e=>console.error(e)):console.log("Service worker not supported in this browser.")})([])',
  fe = _("qc-s"),
  Qe = _("qc-c"),
  Ue = _("qc-ic"),
  de = _("qc-h"),
  he = _("qc-l"),
  _e = _("qc-n"),
  me = _("qc-a"),
  Me = _("qc-ir"),
  $e = _("qc-p"),
  ze = J(m(() => g(() => import("./q-CZ28vsux.js"), []), "s_gNwUJOjjmEc")),
  He = O(m(() => g(() => import("./q-FGBBPsjp.js"), []), "s_yPdH7y4ImA0")),
  x = new WeakMap(),
  C = new Map(),
  N = new Set(),
  K = "qaction",
  Ke = "qfunc",
  Ye = "qdata",
  S = (e) => e.pathname + e.search + e.hash,
  v = (e, n) => new URL(e, n.href),
  ge = (e, n) => e.origin === n.origin,
  V = (e) => e.endsWith("/") ? e : e + "/",
  Y = ({ pathname: e }, { pathname: n }) => {
    const t = Math.abs(e.length - n.length);
    return t === 0 ? e === n : t === 1 && V(e) === V(n);
  },
  ve = (e, n) => e.search === n.search,
  R = (e, n) => ve(e, n) && Y(e, n),
  ye = (e, n, t) => {
    let r = n ?? "";
    return t && (r += (r ? "&" : "?") + K + "=" + encodeURIComponent(t.id)),
      e + (e.endsWith("/") ? "" : "/") + "q-data.json" + r;
  },
  Be = (e, n) => {
    const t = e.href;
    if (typeof t == "string" && typeof e.target != "string" && !e.reload) {
      try {
        const r = v(t.trim(), n.url), o = v("", n.url);
        if (ge(r, o)) return S(r);
      } catch (r) {
        console.error(r);
      }
    } else if (e.reload) return S(v("", n.url));
    return null;
  },
  Xe = (e, n) => {
    if (e) {
      const t = v(e, n.url), r = v("", n.url);
      return !R(t, r);
    }
    return !1;
  },
  Ge = (e, n) => {
    if (e) {
      const t = v(e, n.url), r = v("", n.url);
      return !Y(t, r);
    }
    return !1;
  },
  be = (e) => e && typeof e.then == "function",
  Je = (e, n, t, r) => {
    const o = we(),
      a = {
        head: o,
        withLocale: (i) => p(r, i),
        resolveValue: (i) => {
          const c = i.__id;
          if (i.__brand === "server_loader" && !(c in e.loaders)) {
            throw new Error(
              "You can not get the returned data of a loader that has not been executed for this request.",
            );
          }
          const u = e.loaders[c];
          if (be(u)) {
            throw new Error(
              "Loaders returning a promise can not be resolved for the head function.",
            );
          }
          return u;
        },
        ...n,
      };
    for (let i = t.length - 1; i >= 0; i--) {
      const c = t[i] && t[i].head;
      c &&
        (typeof c == "function"
          ? W(o, p(r, () => c(a)))
          : typeof c == "object" && W(o, c));
    }
    return a.head;
  },
  W = (e, n) => {
    typeof n.title == "string" && (e.title = n.title),
      E(e.meta, n.meta),
      E(e.links, n.links),
      E(e.styles, n.styles),
      E(e.scripts, n.scripts),
      Object.assign(e.frontmatter, n.frontmatter);
  },
  E = (e, n) => {
    if (Array.isArray(n)) {
      for (const t of n) {
        if (typeof t.key == "string") {
          const r = e.findIndex((o) => o.key === t.key);
          if (r > -1) {
            e[r] = t;
            continue;
          }
        }
        e.push(t);
      }
    }
  },
  we = () => ({
    title: "",
    meta: [],
    links: [],
    styles: [],
    scripts: [],
    frontmatter: {},
  });
function Ce(e, n) {
  const t = U(e), r = F(e), o = U(n), s = F(n);
  return B(e, t, r, n, o, s);
}
function B(e, n, t, r, o, s) {
  let a = null;
  for (; n < t;) {
    const i = e.charCodeAt(n++), c = r.charCodeAt(o++);
    if (i === 91) {
      const u = X(e, n),
        l = n + (u ? 3 : 0),
        f = A(e, l, t, 93),
        d = e.substring(l, f),
        h = A(e, f + 1, t, 47),
        y = e.substring(f + 1, h);
      n = f + 1;
      const b = o - 1;
      if (u) {
        const j = Se(d, y, r, b, s, e, n + y.length + 1, t);
        if (j) return Object.assign(a || (a = {}), j);
      }
      const P = A(r, b, s, 47, y);
      if (P == -1) return null;
      const T = r.substring(b, P);
      if (!u && !y && !T) return null;
      o = P, (a || (a = {}))[d] = decodeURIComponent(T);
    } else if (i !== c && !(isNaN(c) && Ee(e, n))) return null;
  }
  return Q(e, n) && Q(r, o) ? a || {} : null;
}
function Ee(e, n) {
  return e.charCodeAt(n) === 91 && X(e, n + 1);
}
function F(e) {
  const n = e.length;
  return n > 1 && e.charCodeAt(n - 1) === 47 ? n - 1 : n;
}
function Q(e, n) {
  const t = e.length;
  return n >= t || n == t - 1 && e.charCodeAt(n) === 47;
}
function U(e) {
  return e.charCodeAt(0) === 47 ? 1 : 0;
}
function X(e, n) {
  return e.charCodeAt(n) === 46 && e.charCodeAt(n + 1) === 46 &&
    e.charCodeAt(n + 2) === 46;
}
function A(e, n, t, r, o = "") {
  for (; n < t && e.charCodeAt(n) !== r;) n++;
  const s = o.length;
  for (let a = 0; a < s; a++) {
    if (e.charCodeAt(n - s + a) !== o.charCodeAt(a)) return -1;
  }
  return n - s;
}
function Se(e, n, t, r, o, s, a, i) {
  t.charCodeAt(r) === 47 && r++;
  let c = o;
  const u = n + "/";
  for (; c >= r;) {
    const l = B(s, a, i, t, c, o);
    if (l) {
      let d = t.substring(r, Math.min(c, o));
      return d.endsWith(u) && (d = d.substring(0, d.length - u.length)),
        l[e] = decodeURIComponent(d),
        l;
    }
    const f = Pe(t, r, u, c, r - 1) + u.length;
    if (c === f) break;
    c = f;
  }
  return null;
}
function Pe(e, n, t, r, o) {
  let s = e.lastIndexOf(t, r);
  return s == r - t.length && (s = e.lastIndexOf(t, r - t.length - 1)),
    s > n ? s : o;
}
const Ze = async (e, n, t, r) => {
    if (!Array.isArray(e)) return null;
    for (const o of e) {
      const s = o[0], a = Ce(s, r);
      if (!a) continue;
      const i = o[1], c = o[3], u = new Array(i.length), l = [];
      i.forEach((h, y) => {
        M(h, l, (b) => u[y] = b);
      });
      const f = Ae(n, r);
      let d;
      return M(f, l, (h) => d = h == null ? void 0 : h.default),
        l.length > 0 && await Promise.all(l),
        [s, a, u, d, c];
    }
    return null;
  },
  M = (e, n, t, r) => {
    if (typeof e == "function") {
      const o = x.get(e);
      if (o) t(o);
      else {
        const s = e();
        typeof s.then == "function"
          ? n.push(s.then((a) => {
            x.set(e, a), t(a);
          }))
          : s && t(s);
      }
    }
  },
  Ae = (e, n) => {
    if (e) {
      n = n.endsWith("/") ? n : n + "/";
      const t = e.find((r) =>
        r[0] === n || n.startsWith(r[0] + (n.endsWith("/") ? "" : "/"))
      );
      if (t) return t[1];
    }
  },
  et = (e, n, t, r, o = !1) => {
    if (n !== "popstate") {
      const s = R(t, r), a = t.hash === r.hash;
      if (!s || !a) {
        const i = { _qCityScroll: qe() };
        o
          ? e.history.replaceState(i, "", S(r))
          : e.history.pushState(i, "", S(r));
      }
    }
  },
  qe = () => ({ x: 0, y: 0, w: 0, h: 0 }),
  De = (e) => {
    e = e.endsWith("/") ? e : e + "/",
      N.has(e) ||
      (N.add(e),
        document.dispatchEvent(
          new CustomEvent("qprefetch", { detail: { links: [e] } }),
        ));
  },
  tt = async (e, n, t) => {
    const r = e.pathname,
      o = e.search,
      s = ye(r, o, t == null ? void 0 : t.action);
    let a;
    t != null && t.action || (a = C.get(s)),
      (t == null ? void 0 : t.prefetchSymbols) !== !1 && De(r);
    let i;
    if (!a) {
      const c = ke(
        t == null ? void 0 : t.action,
        t == null ? void 0 : t.clearCache,
      );
      t != null && t.action && (t.action.data = void 0),
        a = fetch(s, c).then((u) => {
          if (u.redirected) {
            const l = new URL(u.url);
            if (
              !l.pathname.endsWith("/q-data.json") ||
              l.origin !== location.origin
            ) {
              location.href = l.href;
              return;
            }
          }
          if ((u.headers.get("content-type") || "").includes("json")) {
            return u.text().then((l) => {
              const f = $(l, n);
              if (!f) {
                location.href = e.href;
                return;
              }
              if (t != null && t.clearCache && C.delete(s), f.redirect) {
                location.href = f.redirect;
              } else if (t != null && t.action) {
                const { action: d } = t, h = f.loaders[d.id];
                i = () => {
                  d.resolve({ status: u.status, result: h });
                };
              }
              return f;
            });
          }
          (t == null ? void 0 : t.isPrefetch) !== !0 &&
            (location.href = e.href);
        }),
        t != null && t.action || C.set(s, a);
    }
    return a.then((c) => (c || C.delete(s), i && i(), c));
  },
  ke = (e, n) => {
    const t = e == null ? void 0 : e.data;
    return t
      ? t instanceof FormData ? { method: "POST", body: t } : {
        method: "POST",
        body: JSON.stringify(t),
        headers: { "Content-Type": "application/json, charset=UTF-8" },
      }
      : n
      ? {
        cache: "no-cache",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      }
      : void 0;
  },
  nt = () => w(de),
  Oe = () => w(he),
  Re = () => w(_e),
  Te = () => w(me),
  rt = () => Z(ee("qwikcity")),
  ot = (e, n, t, r, o) => {
    e === "popstate" && o
      ? r.scrollTo(o.x, o.y)
      : (e === "link" || e === "form") && (je(n, t) || r.scrollTo(0, 0));
  },
  je = (e, n) => {
    const t = e.hash.slice(1), r = t && document.getElementById(t);
    return r ? (r.scrollIntoView(), !0) : !!(!r && e.hash && R(e, n));
  },
  st = (e) => ({
    x: e.scrollLeft,
    y: e.scrollTop,
    w: Math.max(e.scrollWidth, e.clientWidth),
    h: Math.max(e.scrollHeight, e.clientHeight),
  }),
  at = () => {
    const e = history.state;
    return e == null ? void 0 : e._qCityScroll;
  },
  it = (e) => {
    const n = history.state || {};
    n._qCityScroll = e, history.replaceState(n, "");
  },
  ct = "_qCityScroller",
  lt = {},
  ut = { navCount: 0 },
  ft = O(
    m(
      () => g(() => import("./q-B3XvjUxO.js").then((e) => e.i), []),
      "s_8X6hWgnQRxE",
    ),
  );
function dt(e) {
  for (; e && e.nodeType !== Node.ELEMENT_NODE;) e = e.parentElement;
  return e.closest("[q\\:container]");
}
const ht = (e) =>
    re(
      "script",
      { nonce: q(e, "nonce") },
      { dangerouslySetInnerHTML: ue },
      null,
      3,
      "P4_7",
    ),
  _t = (e, ...n) => {
    const { id: t, validators: r } = G(n, e);
    function o() {
      const s = Oe(),
        a = Te(),
        i = {
          actionPath: `?${K}=${t}`,
          submitted: !1,
          isRunning: !1,
          status: void 0,
          value: void 0,
          formData: void 0,
        },
        c = te(() => {
          const l = a.value;
          if (l && (l == null ? void 0 : l.id) === t) {
            const f = l.data;
            if (f instanceof FormData && (i.formData = f), l.output) {
              const { status: d, result: h } = l.output;
              i.status = d, i.value = h;
            }
          }
          return i;
        }),
        u = m(() => g(() => import("./q-TfmFxDYu.js"), []), "s_iq02af90j2s", [
          a,
          t,
          s,
          c,
        ]);
      return i.submit = u, c;
    }
    return o.__brand = "server_action",
      o.__validators = r,
      o.__qrl = e,
      o.__id = t,
      Object.freeze(o),
      o;
  },
  mt = (e, ...n) => {
    const { id: t, validators: r } = G(n, e);
    function o() {
      return w(fe, (s) => {
        if (!(t in s)) {
          throw new Error(
            `routeLoader$ "${e.getSymbol()}" was invoked in a route where it was not declared.
    This is because the routeLoader$ was not exported in a 'layout.tsx' or 'index.tsx' file of the existing route.
    For more information check: https://qwik.dev/qwikcity/route-loader/

    If your are managing reusable logic or a library it is essential that this function is re-exported from within 'layout.tsx' or 'index.tsx file of the existing route otherwise it will not run or throw exception.
    For more information check: https://qwik.dev/docs/cookbook/re-exporting-loaders/`,
          );
        }
        return ne(s, t);
      });
    }
    return o.__brand = "server_loader",
      o.__qrl = e,
      o.__validators = r,
      o.__id = t,
      Object.freeze(o),
      o;
  },
  gt = (e) => {},
  G = (e, n) => {
    let t;
    const r = [];
    if (e.length === 1) {
      const o = e[0];
      o && typeof o == "object" &&
        ("validate" in o
          ? r.push(o)
          : (t = o.id, o.validation && r.push(...o.validation)));
    } else e.length > 1 && r.push(...e.filter((o) => !!o));
    return typeof t == "string" ? t = `id_${t}` : t = n.getHash(),
      { validators: r.reverse(), id: t };
  },
  vt = async function* (e, n, t) {
    const r = e.getReader();
    try {
      let o = "";
      const s = new TextDecoder();
      for (; !(t != null && t.aborted);) {
        const a = await r.read();
        if (a.done) break;
        o += s.decode(a.value, { stream: !0 });
        const i = o.split(/\n/);
        o = i.pop();
        for (const c of i) yield await $(c, n);
      }
    } finally {
      r.releaseLock();
    }
  },
  yt = (
    { action: e, spaReset: n, reloadDocument: t, onSubmit$: r, ...o },
    s,
  ) => (oe(),
    e
      ? Array.isArray(r)
        ? D(
          "form",
          {
            ...o,
            get action() {
              return e.actionPath;
            },
            action: q(e, "actionPath"),
            "preventdefault:submit": !t,
            method: "post",
            "data-spa-reset": n ? "true" : void 0,
            onSubmit$: [
              ...r,
              t ? void 0 : m(
                () => g(() => import("./q-BjteJSFI.js").then((i) => i.K), []),
                "s_VXFb4R77gNw",
                [e],
              ),
            ],
          },
          { method: k },
          0,
          s,
        )
        : D(
          "form",
          {
            ...o,
            get action() {
              return e.actionPath;
            },
            action: q(e, "actionPath"),
            "preventdefault:submit": !t,
            method: "post",
            "data-spa-reset": n ? "true" : void 0,
            onSubmit$: [t ? void 0 : e.submit, r],
          },
          { method: k },
          0,
          s,
        )
      : z(pe, { spaReset: n, reloadDocument: t, onSubmit$: r, ...o }, 0, s)),
  pe = O(
    m(() => g(() => Promise.resolve().then(() => Le), void 0), "s_d5PZYh2bVVI"),
  ),
  Ie = (e) => {
    const n = se(e, ["action", "spaReset", "reloadDocument", "onSubmit$"]),
      t = Re();
    return D(
      "form",
      {
        action: "get",
        get "preventdefault:submit"() {
          return !e.reloadDocument;
        },
        get "data-spa-reset"() {
          return e.spaReset ? "true" : void 0;
        },
        ...n,
        children: z(ae, null, 3, "P4_8"),
        onSubmit$: [
          ...Array.isArray(e.onSubmit$) ? e.onSubmit$ : [e.onSubmit$],
          m(
            () => g(() => Promise.resolve().then(() => Ne), void 0),
            "s_i0j0Ky0dmXI",
            [t],
          ),
          m(
            () => g(() => Promise.resolve().then(() => We), void 0),
            "s_jDIH6nOiKOA",
          ),
        ],
      },
      {
        action: k,
        "preventdefault:submit": I((r) => !r.reloadDocument, [e]),
        "data-spa-reset": I((r) => r.spaReset ? "true" : void 0, [e]),
      },
      0,
      "P4_9",
    );
  },
  Le = Object.freeze(
    Object.defineProperty(
      { __proto__: null, s_d5PZYh2bVVI: Ie },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  xe = async (e, n) => {
    const [t] = ie(), r = new FormData(n), o = new URLSearchParams();
    r.forEach((s, a) => {
      typeof s == "string" && o.append(a, s);
    }), await t("?" + o.toString(), { type: "form", forceReload: !0 });
  },
  Ne = Object.freeze(
    Object.defineProperty(
      { __proto__: null, _hW: H, s_i0j0Ky0dmXI: xe },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  Ve = (e, n) => {
    n.getAttribute("data-spa-reset") === "true" && n.reset(),
      n.dispatchEvent(
        new CustomEvent("submitcompleted", {
          bubbles: !1,
          cancelable: !1,
          composed: !1,
          detail: { status: 200 },
        }),
      );
  },
  We = Object.freeze(
    Object.defineProperty(
      { __proto__: null, _hW: H, s_jDIH6nOiKOA: Ve },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  );
export {
  $e as k,
  _e as e,
  _t as N,
  at as o,
  Be as g,
  C as t,
  ct as Q,
  De as p,
  de as D,
  dt as A,
  et as z,
  fe as f,
  ft as L,
  g as _,
  Ge as b,
  ge as v,
  gt as O,
  He as M,
  he as R,
  ht as S,
  Ie as s_d5PZYh2bVVI,
  it as w,
  Je as r,
  Ke as G,
  lt as E,
  Me as i,
  me as h,
  mt as K,
  nt as J,
  Oe as a,
  ot as q,
  Qe as C,
  R as n,
  Re as u,
  rt as j,
  st as x,
  tt as l,
  Ue as d,
  ut as F,
  v as B,
  Ve as U,
  vt as H,
  we as c,
  Xe as s,
  xe as T,
  Ye as I,
  yt as P,
  Ze as m,
  ze as y,
};
