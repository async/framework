import {
  _ as C,
  A as qe,
  B as Re,
  C as _e,
  c as de,
  D as pe,
  d as ve,
  E as i,
  e as fe,
  F as x,
  f as ye,
  h as he,
  i as Se,
  j as ue,
  k as be,
  l as oe,
  m as K,
  n as k,
  o as ne,
  Q as re,
  q as se,
  R as me,
  r as Ce,
  t as we,
  v as X,
  w as A,
  x as P,
  y as ge,
  z as Ee,
} from "./q-DwB5CxdB.js";
import {
  _hW as G,
  A as Ae,
  a as Pe,
  B as ae,
  b as N,
  C as $e,
  l as Oe,
  n as xe,
  p as ie,
  q as H,
  S as De,
  t as B,
  v as y,
  x as Le,
  y as ke,
  z as Ie,
} from "./q-BjteJSFI.js";
const Te = (r) => {
    Le(
      H(
        () => C(() => Promise.resolve().then(() => Me), void 0),
        "s_i0OX5Main1M",
      ),
    );
    const n = ue();
    if (!(n != null && n.params)) {
      throw new Error(
        "Missing Qwik City Env Data for help visit https://github.com/QwikDev/qwik/issues/6237",
      );
    }
    const h = Pe("url");
    if (!h) throw new Error("Missing Qwik URL Env Data");
    const v = new URL(h),
      a = N({ url: v, params: n.params, isNavigating: !1, prevUrl: void 0 }, {
        deep: !1,
      }),
      E = {},
      d = ke(N(n.response.loaders, { deep: !1 })),
      m = B({
        type: "initial",
        dest: v,
        forceReload: !1,
        replaceState: !1,
        scroll: !0,
      }),
      S = N(de),
      q = N({ headings: void 0, menu: void 0 }),
      l = B(),
      t = n.response.action,
      _ = t ? n.response.loaders[t] : void 0,
      c = B(
        _
          ? {
            id: t,
            data: n.response.formData,
            output: { result: _, status: n.response.status },
          }
          : void 0,
      ),
      R = H(
        () => C(() => Promise.resolve().then(() => Qe), void 0),
        "s_SNVSoEmabck",
      ),
      $ = H(
        () => C(() => Promise.resolve().then(() => He), void 0),
        "s_Aqeo8lKe3IU",
        [c, E, m, a],
      );
    return y(_e, q),
      y(ve, l),
      y(pe, S),
      y(me, a),
      y(fe, $),
      y(ye, d),
      y(he, c),
      y(Se, m),
      y(be, R),
      Ie(
        H(
          () => C(() => Promise.resolve().then(() => Ve), void 0),
          "s_RZOV0QbO60Y",
          [c, q, l, S, n, $, d, E, r, m, a],
        ),
      ),
      Oe(De, null, 3, "P4_3");
  },
  Ke = Object.freeze(
    Object.defineProperty(
      { __proto__: null, s_8X6hWgnQRxE: Te },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  );
const W = () => C(() => import("./q-CCKrurEM.js").then((r) => r.l), []),
  Y = [["/", [W, () => C(() => import("./q-CNNHGku2.js"), [])]], [
    "demo/flower/",
    [W, () => C(() => import("./q-C5TRCQw7.js"), [])],
  ], ["demo/todolist/", [
    W,
    () => C(() => import("./q-BMNdx4VW.js").then((r) => r.i), []),
  ]]],
  Z = [];
const F = !0;
const je = ({ track: r }) => {
    const [n, h, v, a, E, d, m, S, q, l, t] = ie();
    async function _() {
      var J;
      const [c, R] = r(() => [l.value, n.value]),
        $ = Ae(""),
        I = t.url,
        f = R ? "form" : c.type,
        le = c.replaceState;
      let s, O, z = null, T;
      {
        s = new URL(c.dest, location),
          s.pathname.endsWith("/") || (s.pathname += "/");
        let j = K(Y, Z, F, s.pathname);
        T = ae();
        const V = O = await oe(s, T, { action: R, clearCache: !0 });
        if (!V) {
          l.untrackedValue = { type: f, dest: s };
          return;
        }
        const U = V.href, M = new URL(U, s);
        k(M, s) || (s = M, j = K(Y, Z, F, s.pathname));
        try {
          z = await j;
        } catch {
          window.location.href = U;
          return;
        }
      }
      if (z) {
        const [j, V, U, M] = z, D = U, ce = D[D.length - 1];
        c.dest.search && (s.search = c.dest.search),
          t.prevUrl = I,
          t.url = s,
          t.params = { ...V },
          l.untrackedValue = { type: f, dest: s };
        const L = Ce(O, t, D, $);
        h.headings = ce.headings,
          h.menu = M,
          v.value = xe(D),
          a.links = L.links,
          a.meta = L.meta,
          a.styles = L.styles,
          a.scripts = L.scripts,
          a.title = L.title,
          a.frontmatter = L.frontmatter;
        {
          q.viewTransition !== !1 && (document.__q_view_transition__ = !0);
          let ee;
          f === "popstate" && (ee = ne());
          const w = document.getElementById(re) ?? document.documentElement;
          (c.scroll && (!c.forceReload || !k(s, I)) &&
              (f === "link" || f === "popstate") || f === "form" && !k(s, I)) &&
            (document.__q_scroll_restore__ = () => se(f, s, I, w, ee));
          const te = O == null ? void 0 : O.loaders, e = window;
          if (te && Object.assign(m, te), we.clear(), !e._qCitySPA) {
            if (
              e._qCitySPA = !0,
                history.scrollRestoration = "manual",
                e.addEventListener("popstate", () => {
                  e._qCityScrollEnabled = !1,
                    clearTimeout(e._qCityScrollDebounce),
                    d(location.href, { type: "popstate" });
                }),
                e.removeEventListener("popstate", e._qCityInitPopstate),
                e._qCityInitPopstate = void 0,
                !e._qCityHistoryPatch
            ) {
              e._qCityHistoryPatch = !0;
              const u = history.pushState,
                b = history.replaceState,
                g = (
                  o,
                ) => (o === null || typeof o > "u"
                  ? o = {}
                  : (o == null ? void 0 : o.constructor) !== Object &&
                    (o = { _data: o }),
                  o._qCityScroll = o._qCityScroll || P(w),
                  o);
              history.pushState = (
                o,
                p,
                Q,
              ) => (o = g(o), u.call(history, o, p, Q)),
                history.replaceState = (
                  o,
                  p,
                  Q,
                ) => (o = g(o), b.call(history, o, p, Q));
            }
            document.body.addEventListener("click", (u) => {
              if (u.defaultPrevented) return;
              const b = u.target.closest("a[href]");
              if (b && !b.hasAttribute("preventdefault:click")) {
                const g = b.getAttribute("href"),
                  o = new URL(location.href),
                  p = new URL(g, o);
                if (X(p, o) && k(p, o)) {
                  if (u.preventDefault(), !p.hash && !p.href.endsWith("#")) {
                    p.href !== o.href && history.pushState(null, "", p),
                      e._qCityScrollEnabled = !1,
                      clearTimeout(e._qCityScrollDebounce),
                      A({ ...P(w), x: 0, y: 0 }),
                      location.reload();
                    return;
                  }
                  d(b.getAttribute("href"));
                }
              }
            }),
              document.body.removeEventListener("click", e._qCityInitAnchors),
              e._qCityInitAnchors = void 0,
              window.navigation ||
              (document.addEventListener("visibilitychange", () => {
                if (
                  e._qCityScrollEnabled && document.visibilityState === "hidden"
                ) {
                  const u = P(w);
                  A(u);
                }
              }, { passive: !0 }),
                document.removeEventListener(
                  "visibilitychange",
                  e._qCityInitVisibility,
                ),
                e._qCityInitVisibility = void 0),
              e.addEventListener("scroll", () => {
                e._qCityScrollEnabled &&
                  (clearTimeout(e._qCityScrollDebounce),
                    e._qCityScrollDebounce = setTimeout(() => {
                      const u = P(w);
                      A(u), e._qCityScrollDebounce = void 0;
                    }, 200));
              }, { passive: !0 }),
              removeEventListener("scroll", e._qCityInitScroll),
              e._qCityInitScroll = void 0,
              (J = e._qCityBootstrap) == null || J.remove(),
              e._qCityBootstrap = void 0,
              ge.resolve();
          }
          if (f !== "popstate") {
            e._qCityScrollEnabled = !1, clearTimeout(e._qCityScrollDebounce);
            const u = P(w);
            A(u);
          }
          Ee(window, f, I, s, le),
            $e(T).then(() => {
              var g;
              qe(T).setAttribute("q:route", j);
              const b = P(w);
              A(b),
                e._qCityScrollEnabled = !0,
                t.isNavigating = !1,
                (g = S.r) == null || g.call(S);
            });
        }
      }
    }
    _();
  },
  Ve = Object.freeze(
    Object.defineProperty(
      { __proto__: null, _hW: G, s_RZOV0QbO60Y: je },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  Ue = ":root{view-transition-name:none}",
  Me = Object.freeze(
    Object.defineProperty(
      { __proto__: null, s_i0OX5Main1M: Ue },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  Ne = async (r, n) => {
    const [h, v, a, E] = ie(),
      {
        type: d = "link",
        forceReload: m = r === void 0,
        replaceState: S = !1,
        scroll: q = !0,
      } = typeof n == "object" ? n : { forceReload: n };
    x.navCount++;
    const l = a.value.dest,
      t = r === void 0 ? l : typeof r == "number" ? r : Re(r, E.url);
    if (i.$cbs$ && (m || typeof t == "number" || !k(t, l) || !X(t, l))) {
      const _ = x.navCount,
        c = await Promise.all([...i.$cbs$.values()].map((R) => R(t)));
      if (_ !== x.navCount || c.some(Boolean)) {
        _ === x.navCount && d === "popstate" && history.pushState(null, "", l);
        return;
      }
    }
    if (typeof t == "number") {
      history.go(t);
      return;
    }
    if (!X(t, l)) {
      location.href = t.href;
      return;
    }
    if (!m && k(t, l)) {
      {
        d === "link" && t.href !== location.href &&
          history.pushState(null, "", t);
        const _ = document.getElementById(re) ?? document.documentElement;
        se(d, t, new URL(location.href), _, ne()),
          d === "popstate" && (window._qCityScrollEnabled = !0);
      }
      return;
    }
    return a.value = {
      type: d,
      dest: t,
      forceReload: m,
      replaceState: S,
      scroll: q,
    },
      oe(t, ae()),
      K(Y, Z, F, t.pathname),
      h.value = void 0,
      E.isNavigating = !0,
      new Promise((_) => {
        v.r = _;
      });
  },
  He = Object.freeze(
    Object.defineProperty(
      { __proto__: null, _hW: G, s_Aqeo8lKe3IU: Ne },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  ze = (r) => (i.$handler$ || (i.$handler$ = (n) => {
    if (x.navCount++, !i.$cbs$) return;
    [...i.$cbs$.values()].map((v) => v.resolved ? v.resolved() : v()).some(
      Boolean,
    ) && (n.preventDefault(), n.returnValue = !0);
  }),
    (i.$cbs$ || (i.$cbs$ = new Set())).add(r),
    r.resolve(),
    window.addEventListener("beforeunload", i.$handler$),
    () => {
      i.$cbs$ &&
        (i.$cbs$.delete(r),
          i.$cbs$.size ||
          (i.$cbs$ = void 0,
            window.removeEventListener("beforeunload", i.$handler$)));
    }),
  Qe = Object.freeze(
    Object.defineProperty(
      { __proto__: null, _hW: G, s_SNVSoEmabck: ze },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  );
export { je as s, Ke as i, Ne as b, Te as s_8X6hWgnQRxE, Ue as a, ze as c };
