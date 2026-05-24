const Ee = (e) => e && typeof e.nodeType == "number",
  ts = (e) => e.nodeType === 9,
  ce = (e) => e.nodeType === 1,
  le = (e) => {
    const t = e.nodeType;
    return t === 1 || t === 111;
  },
  yr = (e) => {
    const t = e.nodeType;
    return t === 1 || t === 111 || t === 3;
  },
  j = (e) => e.nodeType === 111,
  Ut = (e) => e.nodeType === 3,
  Ke = (e) => e.nodeType === 8,
  Se = (e, ...t) => Jt(!1, e, ...t),
  vr = (e, ...t) => {
    throw Jt(!1, e, ...t);
  },
  Gt = (e, ...t) => Jt(!0, e, ...t),
  ke = () => {},
  Er = (e) => e,
  Jt = (e, t, ...n) => {
    const s = t instanceof Error ? t : new Error(t);
    return console.error("%cQWIK ERROR", "", s.message, ...Er(n), s.stack),
      e && setTimeout(() => {
        throw s;
      }, 0),
      s;
  };
const pt = (e) =>
    `Code(${e}) https://github.com/QwikDev/qwik/blob/main/packages/qwik/src/core/error/error.ts#L${
      8 + e
    }`,
  M = (e, ...t) => {
    const n = pt(e, ...t);
    return Gt(n, ...t);
  },
  xr = () => ({
    isServer: !1,
    importSymbol(e, t, n) {
      if (!t) throw M(31, n);
      if (!e) throw M(30, t, n);
      const s = br(e.ownerDocument, e, t).toString(), r = new URL(s);
      return r.hash = "", import(r.href).then((o) => o[n]);
    },
    raf: (e) =>
      new Promise((t) => {
        requestAnimationFrame(() => {
          t(e());
        });
      }),
    nextTick: (e) =>
      new Promise((t) => {
        setTimeout(() => {
          t(e());
        });
      }),
    chunkForSymbol: (e, t) => [e, t ?? "_"],
  }),
  br = (e, t, n) => {
    const s = e.baseURI, r = new URL(t.getAttribute("q:base") ?? s, s);
    return new URL(n, r);
  };
let ns = xr();
const Xt = () => ns,
  ht = () => ns.isServer,
  mt = (e) => {
    const t = Object.getPrototypeOf(e);
    return t === Object.prototype || t === null;
  },
  ae = (e) => !!e && typeof e == "object",
  R = (e) => Array.isArray(e),
  Le = (e) => typeof e == "string",
  U = (e) => typeof e == "function",
  V = (e) => e && typeof e.then == "function",
  gt = (e, t, n) => {
    try {
      const s = e();
      return V(s) ? s.then(t, n) : t(s);
    } catch (s) {
      return n(s);
    }
  },
  A = (e, t) => V(e) ? e.then(t) : t(e),
  Vt = (e) => e.some(V) ? Promise.all(e) : e,
  Ie = (e) => e.length > 0 ? Promise.all(e) : e,
  ss = (e) => e != null,
  wr = (e) =>
    new Promise((t) => {
      setTimeout(t, e);
    }),
  ne = [],
  F = {},
  Ye = (e) =>
    typeof document < "u" ? document : e.nodeType === 9 ? e : e.ownerDocument,
  _r = "q:renderFn",
  re = "q:slot",
  rs = "q:s",
  Kt = "q:style",
  os = "q:instance",
  $s = (e, t) => e["qFuncs_" + t] || [],
  Ct = Symbol("proxy target"),
  Ce = Symbol("proxy flags"),
  Z = Symbol("proxy manager"),
  N = Symbol("IMMUTABLE"),
  Yt = "_qc_",
  Q = (e, t, n) => e.setAttribute(t, n),
  K = (e, t) => e.getAttribute(t),
  Zt = (e) => e.replace(/([A-Z])/g, "-$1").toLowerCase(),
  Tr = (e) => e.replace(/-./g, (t) => t[1].toUpperCase()),
  Ar = /^(on|window:|document:)/,
  Ir = "preventdefault:",
  is = (e) => e.endsWith("$") && Ar.test(e),
  Cr = (e) => {
    if (e.length === 0) return ne;
    if (e.length === 1) {
      const n = e[0];
      return [[n[0], [n[1]]]];
    }
    const t = [];
    for (let n = 0; n < e.length; n++) {
      const s = e[n][0];
      t.includes(s) || t.push(s);
    }
    return t.map((n) => [n, e.filter((s) => s[0] === n).map((s) => s[1])]);
  },
  cs = (e, t, n, s) => {
    if (t.endsWith("$"), t = Mt(t.slice(0, -1)), n) {
      if (R(n)) {
        const r = n.flat(1 / 0).filter((o) => o != null).map(
          (o) => [t, Pn(o, s)],
        );
        e.push(...r);
      } else e.push([t, Pn(n, s)]);
    }
    return t;
  },
  Nn = ["on", "window:on", "document:on"],
  Mr = ["on", "on-window", "on-document"],
  Mt = (e) => {
    let t = "on";
    for (let n = 0; n < Nn.length; n++) {
      const s = Nn[n];
      if (e.startsWith(s)) {
        t = Mr[n], e = e.slice(s.length);
        break;
      }
    }
    return t + ":" + (e = e.startsWith("-") ? Zt(e.slice(1)) : e.toLowerCase());
  },
  Pn = (e, t) => (e.$setContainer$(t), e),
  Nr = (e, t) => {
    const n = e.$element$.attributes, s = [];
    for (let r = 0; r < n.length; r++) {
      const { name: o, value: $ } = n.item(r);
      if (
        o.startsWith("on:") || o.startsWith("on-window:") ||
        o.startsWith("on-document:")
      ) {
        const c = $.split(`
`);
        for (const i of c) {
          const l = wt(i, t);
          l.$capture$ && Ys(l, e), s.push([o, l]);
        }
      }
    }
    return s;
  },
  Pr = (e, t) => {
    en(jt(e, void 0), t);
  },
  Rn = (e, t) => {
    en(jt(e, "document"), t);
  },
  Qi = (e, t) => {
    en(jt(e, "window"), t);
  },
  jt = (e, t) => {
    const n = t !== void 0 ? t + ":" : "";
    return Array.isArray(e) ? e.map((s) => `${n}on-${s}`) : `${n}on-${e}`;
  },
  en = (e, t) => {
    if (t) {
      const n = gn(),
        s = O(n.$hostElement$, n.$renderCtx$.$static$.$containerState$);
      typeof e == "string"
        ? s.li.push([Mt(e), t])
        : s.li.push(...e.map((r) => [Mt(r), t])), s.$flags$ |= kt;
    }
  },
  Rr = (e, t, n, s) => {
    e &&
      e.dispatchEvent(
        new CustomEvent(t, { detail: n, bubbles: s, composed: s }),
      );
  },
  tn = (e, t, n = 0) =>
    t.$proxyMap$.get(e) || (n !== 0 && yt(e, n), St(e, t, void 0)),
  St = (e, t, n) => {
    Tt(e), t.$proxyMap$.has(e);
    const s = t.$subsManager$.$createManager$(n),
      r = new Proxy(e, new ls(t, s));
    return t.$proxyMap$.set(e, r), r;
  },
  nn = () => {
    const e = {};
    return yt(e, 2), e;
  },
  yt = (e, t) => {
    Object.defineProperty(e, Ce, { value: t, enumerable: !1 });
  },
  Wi = (e, t) => {
    const n = {};
    for (const s in e) t.includes(s) || (n[s] = e[s]);
    return n;
  };
class ls {
  constructor(t, n) {
    this.$containerState$ = t, this.$manager$ = n;
  }
  deleteProperty(t, n) {
    if (2 & t[Ce]) throw M(17);
    return typeof n == "string" && delete t[n] &&
      (this.$manager$.$notifySubs$(R(t) ? void 0 : n), !0);
  }
  get(t, n) {
    var l;
    if (typeof n == "symbol") {
      return n === Ct ? t : n === Z ? this.$manager$ : t[n];
    }
    const s = t[Ce] ?? 0, r = W(), o = !!(1 & s), $ = t["$$" + n];
    let c, i;
    if (
      r && (c = r.$subscriber$),
        !(2 & s) || n in t && !qr((l = t[N]) == null ? void 0 : l[n]) ||
        (c = null),
        $ ? (i = $.value, c = null) : i = t[n],
        c
    ) {
      const a = R(t);
      this.$manager$.$addSub$(c, a ? void 0 : n);
    }
    return o ? kr(i, this.$containerState$) : i;
  }
  set(t, n, s) {
    if (typeof n == "symbol") return t[n] = s, !0;
    const r = t[Ce] ?? 0;
    if (2 & r) throw M(17);
    const o = 1 & r ? Tt(s) : s;
    if (R(t)) return t[n] = o, this.$manager$.$notifySubs$(), !0;
    const $ = t[n];
    return t[n] = o, $ !== o && this.$manager$.$notifySubs$(n), !0;
  }
  has(t, n) {
    if (n === Ct) return !0;
    const s = Object.prototype.hasOwnProperty;
    return !!s.call(t, n) || !(typeof n != "string" || !s.call(t, "$$" + n));
  }
  ownKeys(t) {
    if (!(2 & (t[Ce] ?? 0))) {
      let s = null;
      const r = W();
      r && (s = r.$subscriber$), s && this.$manager$.$addSub$(s);
    }
    return R(t)
      ? Reflect.ownKeys(t)
      : Reflect.ownKeys(t).map((s) =>
        typeof s == "string" && s.startsWith("$$") ? s.slice(2) : s
      );
  }
  getOwnPropertyDescriptor(t, n) {
    return R(t) || typeof n == "symbol"
      ? Object.getOwnPropertyDescriptor(t, n)
      : { enumerable: !0, configurable: !0 };
  }
}
const qr = (e) => e === N || X(e),
  kr = (e, t) => {
    if (ae(e)) {
      if (Object.isFrozen(e)) return e;
      const n = Tt(e);
      if (n !== e || nr(n)) return e;
      if (mt(n) || R(n)) return t.$proxyMap$.get(n) || tn(n, t, 1);
    }
    return e;
  },
  zr = (e, t = 0) => {
    for (let n = 0; n < e.length; n++) {
      t = (t << 5) - t + e.charCodeAt(n), t |= 0;
    }
    return Number(Math.abs(t)).toString(36);
  },
  Or = (e, t) => `${zr(e.$hash$)}-${t}`,
  Lr = (e) => "⭐️" + e,
  Dr = (e) => {
    const t = e.join("|");
    if (t.length > 0) return t;
  },
  xe = () => {
    const e = gn(),
      t = O(e.$hostElement$, e.$renderCtx$.$static$.$containerState$),
      n = t.$seq$ || (t.$seq$ = []),
      s = e.$i$++;
    return { val: n[s], set: (r) => n[s] = r, i: s, iCtx: e, elCtx: t };
  },
  Fr = (e) => Object.freeze({ id: Zt(e) }),
  Bi = (e, t) => {
    const { val: n, set: s, elCtx: r } = xe();
    if (n !== void 0) return;
    (r.$contexts$ || (r.$contexts$ = new Map())).set(e.id, t), s(!0);
  },
  Hi = (e, t) => {
    const { val: n, set: s, iCtx: r, elCtx: o } = xe();
    if (n !== void 0) return n;
    const $ = as(e, o, r.$renderCtx$.$static$.$containerState$);
    if (typeof t == "function") return s(G(void 0, t, $));
    if ($ !== void 0) return s($);
    if (t !== void 0) return s(t);
    throw M(13, e.id);
  },
  Qr = (e, t) => {
    var r;
    let n = e, s = 1;
    for (; n && !((r = n.hasAttribute) != null && r.call(n, "q:container"));) {
      for (; n = n.previousSibling;) {
        if (Ke(n)) {
          const o = n.__virtual;
          if (o) {
            const $ = o[Yt];
            if (n === o.open) return $ ?? O(o, t);
            if ($ != null && $.$parentCtx$) return $.$parentCtx$;
            n = o;
            continue;
          }
          if (n.data === "/qv") s++;
          else if (n.data.startsWith("qv ") && (s--, s === 0)) {
            return O(tt(n), t);
          }
        }
      }
      n = e.parentElement, e = n;
    }
    return null;
  },
  Wr = (
    e,
    t,
  ) => (e.$parentCtx$ === void 0 && (e.$parentCtx$ = Qr(e.$element$, t)),
    e.$parentCtx$),
  as = (e, t, n) => {
    var o;
    const s = e.id;
    if (!t) return;
    let r = t;
    for (; r;) {
      const $ = (o = r.$contexts$) == null ? void 0 : o.get(s);
      if ($) return $;
      r = Wr(r, n);
    }
  },
  Br = Fr("qk-error"),
  sn = (e, t, n) => {
    const s = B(t);
    {
      const r = as(Br, s, n.$static$.$containerState$);
      if (r === void 0) throw e;
      r.error = e;
    }
  },
  Hr = new Set([
    "animationIterationCount",
    "aspectRatio",
    "borderImageOutset",
    "borderImageSlice",
    "borderImageWidth",
    "boxFlex",
    "boxFlexGroup",
    "boxOrdinalGroup",
    "columnCount",
    "columns",
    "flex",
    "flexGrow",
    "flexShrink",
    "gridArea",
    "gridRow",
    "gridRowEnd",
    "gridRowStart",
    "gridColumn",
    "gridColumnEnd",
    "gridColumnStart",
    "fontWeight",
    "lineClamp",
    "lineHeight",
    "opacity",
    "order",
    "orphans",
    "scale",
    "tabSize",
    "widows",
    "zIndex",
    "zoom",
    "MozAnimationIterationCount",
    "MozBoxFlex",
    "msFlex",
    "msFlexPositive",
    "WebkitAnimationIterationCount",
    "WebkitBoxFlex",
    "WebkitBoxOrdinalGroup",
    "WebkitColumnCount",
    "WebkitColumns",
    "WebkitFlex",
    "WebkitFlexGrow",
    "WebkitFlexShrink",
    "WebkitLineClamp",
  ]),
  Ur = (e) => Hr.has(e),
  Nt = (e, t, n) => {
    t.$flags$ &= ~Ue, t.$flags$ |= hn, t.$slots$ = [], t.li.length = 0;
    const s = t.$element$,
      r = t.$componentQrl$,
      o = t.$props$,
      $ = J(e.$static$.$locale$, s, void 0, "qRender"),
      c = $.$waitOn$ = [],
      i = rn(e);
    i.$cmpCtx$ = t,
      i.$slotCtx$ = void 0,
      $.$subscriber$ = [0, s],
      $.$renderCtx$ = e,
      r.$setContainer$(e.$static$.$containerState$.$containerEl$);
    const l = r.getFn($);
    return gt(
      () => l(o),
      (a) =>
        A(
          ht()
            ? A(Ie(c), () => A(ho(e.$static$.$containerState$, e), () => Ie(c)))
            : Ie(c),
          () => {
            var f;
            if (t.$flags$ & Ue) {
              if (!(n && n > 100)) return Nt(e, t, n ? n + 1 : 1);
              ke(
                `Infinite loop detected. Element: ${
                  (f = t.$componentQrl$) == null ? void 0 : f.$symbol$
                }`,
              );
            }
            return { node: a, rCtx: i };
          },
        ),
      (a) => {
        var f;
        if (a === Ns) {
          if (!(n && n > 100)) return A(Ie(c), () => Nt(e, t, n ? n + 1 : 1));
          ke(
            `Infinite loop detected. Element: ${
              (f = t.$componentQrl$) == null ? void 0 : f.$symbol$
            }`,
          );
        }
        return sn(a, s, e), { node: ds, rCtx: i };
      },
    );
  },
  Gr = (e, t) => ({
    $static$: {
      $doc$: e,
      $locale$: t.$serverData$.locale,
      $containerState$: t,
      $hostElements$: new Set(),
      $operations$: [],
      $postOperations$: [],
      $roots$: [],
      $addSlots$: [],
      $rmSlots$: [],
      $visited$: [],
    },
    $cmpCtx$: null,
    $slotCtx$: void 0,
  }),
  rn = (e) => ({
    $static$: e.$static$,
    $cmpCtx$: e.$cmpCtx$,
    $slotCtx$: e.$slotCtx$,
  }),
  on = (e, t) => {
    var n;
    return (n = t == null ? void 0 : t.$scopeIds$) != null && n.length
      ? t.$scopeIds$.join(" ") + " " + Pt(e)
      : Pt(e);
  },
  Pt = (e) => {
    if (!e) return "";
    if (Le(e)) return e.trim();
    const t = [];
    if (R(e)) {
      for (const n of e) {
        const s = Pt(n);
        s && t.push(s);
      }
    } else for (const [n, s] of Object.entries(e)) s && t.push(n.trim());
    return t.join(" ");
  },
  $n = (e) => {
    if (e == null) return "";
    if (typeof e == "object") {
      if (R(e)) throw M(0, e, "style");
      {
        const t = [];
        for (const n in e) {
          if (Object.prototype.hasOwnProperty.call(e, n)) {
            const s = e[n];
            s != null && typeof s != "function" &&
              (n.startsWith("--")
                ? t.push(n + ":" + s)
                : t.push(Zt(n) + ":" + Jr(n, s)));
          }
        }
        return t.join(";");
      }
    }
    return String(e);
  },
  Jr = (e, t) => typeof t != "number" || t === 0 || Ur(e) ? t : t + "px",
  Xr = (e) => $e(e.$static$.$containerState$.$elementIndex$++),
  us = (e, t) => {
    const n = Xr(e);
    t.$id$ = n;
  },
  cn = (e) =>
    X(e) ? cn(e.value) : e == null || typeof e == "boolean" ? "" : String(e);
function Vr(e) {
  return e.startsWith("aria-");
}
const Kr = (e, t) => !!t.key && (!vt(e) || !U(e.type) && e.key != t.key),
  he = "dangerouslySetInnerHTML",
  Ui = (e, t, n) => new zt(e, t, n),
  Yr = (e) => {
    const t = e.$funcStr$;
    let n = "";
    for (let s = 0; s < e.$args$.length; s++) n += `p${s},`;
    return `(${n})=>(${t})`;
  },
  fs = (e, t, n, s, r, o) => {
    const $ = o == null ? null : String(o);
    return new Ze(e, t || F, n, s, r, $);
  },
  Gi = (e, t, n, s, r, o) => {
    let $ = null;
    return t && "children" in t && ($ = t.children, delete t.children),
      fs(e, t, n, $, s, r);
  },
  ln = (e, t, n, s, r) => {
    const o = s == null ? null : String(s), $ = t ?? {};
    if (typeof e == "string" && N in $) {
      const i = $[N];
      delete $[N];
      const l = $.children;
      delete $.children;
      for (const [a, f] of Object.entries(i)) {
        f !== N && (delete $[a], $[a] = f);
      }
      return fs(e, null, $, l, n, s);
    }
    const c = new Ze(e, $, null, $.children, n, o);
    return typeof e == "string" && t && delete t.children, c;
  };
class Ze {
  constructor(t, n, s, r, o, $ = null) {
    this.type = t,
      this.props = n,
      this.immutableProps = s,
      this.children = r,
      this.flags = o,
      this.key = $;
  }
}
const Be = (e) => e.children,
  vt = (e) => e instanceof Ze,
  Rt = (e) => e.children,
  ds = Symbol("skip render"),
  an = (e, t, n) => {
    const s = !(t.$flags$ & hn),
      r = t.$element$,
      o = e.$static$.$containerState$;
    return o.$hostsStaging$.delete(t),
      o.$subsManager$.$clearSub$(r),
      A(Nt(e, t), ($) => {
        const c = e.$static$, i = $.rCtx, l = J(e.$static$.$locale$, r);
        if (
          c.$hostElements$.add(r),
            l.$subscriber$ = [0, r],
            l.$renderCtx$ = i,
            s && t.$appendStyles$
        ) { for (const f of t.$appendStyles$) o$(c, f); }
        const a = oe($.node, l);
        return A(a, (f) => {
          const h = Zr(r, f), p = un(t);
          return A(ct(i, p, h, n), () => {
            t.$vdom$ = h;
          });
        });
      });
  },
  un = (e) => (e.$vdom$ || (e.$vdom$ = lt(e.$element$)), e.$vdom$);
class se {
  constructor(t, n, s, r, o, $) {
    this.$type$ = t,
      this.$props$ = n,
      this.$immutableProps$ = s,
      this.$children$ = r,
      this.$flags$ = o,
      this.$key$ = $,
      this.$elm$ = null,
      this.$text$ = "",
      this.$signal$ = null,
      this.$id$ = t + ($ ? ":" + $ : "");
  }
}
const ps = (e, t) => {
    const {
      key: n,
      type: s,
      props: r,
      children: o,
      flags: $,
      immutableProps: c,
    } = e;
    let i = "";
    if (Le(s)) i = s;
    else {
      if (s !== Be) {
        if (U(s)) {
          const a = G(t, s, r, n, $, e.dev);
          return Kr(a, e) ? ps(ln(Be, { children: a }, 0, n), t) : oe(a, t);
        }
        throw M(25, s);
      }
      i = ze;
    }
    let l = ne;
    return o != null
      ? A(
        oe(o, t),
        (a) => (a !== void 0 && (l = R(a) ? a : [a]), new se(i, r, c, l, $, n)),
      )
      : new se(i, r, c, l, $, n);
  },
  Zr = (e, t) => {
    const n = t === void 0 ? ne : R(t) ? t : [t],
      s = new se(":virtual", {}, null, n, 0, null);
    return s.$elm$ = e, s;
  },
  oe = (e, t) => {
    if (e != null && typeof e != "boolean") {
      if (hs(e)) {
        const n = new se("#text", F, null, ne, 0, null);
        return n.$text$ = String(e), n;
      }
      if (vt(e)) return ps(e, t);
      if (X(e)) {
        const n = new se("#signal", F, null, ne, 0, null);
        return n.$signal$ = e, n;
      }
      if (R(e)) {
        const n = Vt(e.flatMap((s) => oe(s, t)));
        return A(n, (s) => s.flat(100).filter(ss));
      }
      return V(e)
        ? e.then((n) => oe(n, t))
        : e === ds
        ? new se(":skipRender", F, null, ne, 0, null)
        : void ke();
    }
  },
  hs = (e) => Le(e) || typeof e == "number",
  ms = (e) => {
    K(e, "q:container") === "paused" && (eo(e), oo(e));
  },
  jr = (e) => {
    const t = Ye(e), n = so(e === t.documentElement ? t.body : e, "type");
    if (n) return JSON.parse(no(n.firstChild.data) || "{}");
  },
  Ji = (e, t) => {
    const n = JSON.parse(e);
    if (typeof n != "object") return null;
    const { _objs: s, _entry: r } = n;
    if (s === void 0 || r === void 0) return null;
    let o = {}, $ = {};
    if (Ee(t) && le(t)) {
      const l = xt(t);
      l && ($ = be(l), o = l.ownerDocument);
    }
    const c = js($, o);
    for (let l = 0; l < s.length; l++) {
      const a = s[l];
      Le(a) && (s[l] = a === _t ? void 0 : c.prepare(a));
    }
    const i = (l) => s[Y(l)];
    for (const l of s) gs(l, i, c);
    return i(r);
  },
  eo = (e) => {
    if (!Do(e)) return void ke();
    const t = e._qwikjson_ ?? jr(e);
    if (e._qwikjson_ = null, !t) return void ke();
    const n = Ye(e),
      s = e.getAttribute(os),
      r = $s(n, s),
      o = be(e),
      $ = new Map(),
      c = new Map();
    let i = null, l = 0;
    const a = n.createTreeWalker(e, qs);
    for (; i = a.nextNode();) {
      const u = i.data;
      if (l === 0) {
        if (u.startsWith("qv ")) {
          const g = $o(u);
          g >= 0 && $.set(g, i);
        } else if (u.startsWith("t=")) {
          const g = u.slice(2), v = Y(g), d = ro(i);
          $.set(v, d), c.set(v, d.data);
        }
      }
      u === "cq" ? l++ : u === "/cq" && l--;
    }
    const f = e.getElementsByClassName("qc📦").length !== 0;
    e.querySelectorAll("[q\\:id]").forEach((u) => {
      if (f && u.closest("[q\\:container]") !== e) return;
      const g = K(u, "q:id"), v = Y(g);
      $.set(v, u);
    });
    const h = js(o, n),
      p = new Map(),
      m = new Set(),
      S = (
        u,
      ) => (typeof u == "string" && u.length > 0, p.has(u) ? p.get(u) : y(u)),
      y = (u) => {
        if (u.startsWith("#")) {
          const b = u.slice(1), _ = Y(b);
          $.has(_);
          const w = $.get(_);
          if (Ke(w)) {
            if (!w.isConnected) return void p.set(u, void 0);
            const C = tt(w);
            return p.set(u, C), O(C, o), C;
          }
          return ce(w) ? (p.set(u, w), O(w, o), w) : (p.set(u, w), w);
        }
        if (u.startsWith("@")) {
          const b = u.slice(1), _ = Y(b);
          return r[_];
        }
        if (u.startsWith("*")) {
          const b = u.slice(1), _ = Y(b);
          $.has(_);
          const w = c.get(_);
          return p.set(u, w), w;
        }
        const g = Y(u), v = t.objs;
        v.length > g;
        let d = v[g];
        Le(d) && (d = d === _t ? void 0 : h.prepare(d));
        let x = d;
        for (let b = u.length - 1; b >= 0; b--) {
          const _ = fi[u[b]];
          if (!_) break;
          x = _(x, o);
        }
        return p.set(u, x),
          hs(d) || m.has(g) ||
          (m.add(g), to(d, g, t.subs, S, o, h), gs(d, S, h)),
          x;
      };
    o.$elementIndex$ = 1e5,
      o.$pauseCtx$ = { getObject: S, meta: t.ctx, refs: t.refs },
      Q(e, "q:container", "resumed"),
      Rr(e, "qresume", void 0, !0);
  },
  to = (e, t, n, s, r, o) => {
    const $ = n[t];
    if ($) {
      const c = [];
      let i = 0;
      for (const l of $) {
        if (l.startsWith("_")) i = parseInt(l.slice(1), 10);
        else {
          const a = mi(l, s);
          a && c.push(a);
        }
      }
      if (i > 0 && yt(e, i), !o.subs(e, c)) {
        const l = r.$proxyMap$.get(e);
        l ? z(l).$addSubs$(c) : St(e, r, c);
      }
    }
  },
  gs = (e, t, n) => {
    if (!n.fill(e, t) && e && typeof e == "object") {
      if (R(e)) {
        for (let s = 0; s < e.length; s++) e[s] = t(e[s]);
      } else if (mt(e)) {
        for (const s in e) e[s] = t(e[s]);
      }
    }
  },
  no = (e) => e.replace(/\\x3C(\/?script)/gi, "<$1"),
  so = (e, t) => {
    let n = e.lastElementChild;
    for (; n;) {
      if (n.tagName === "SCRIPT" && K(n, t) === "qwik/json") return n;
      n = n.previousElementSibling;
    }
  },
  ro = (e) => {
    const t = e.nextSibling;
    if (Ut(t)) return t;
    {
      const n = e.ownerDocument.createTextNode("");
      return e.parentElement.insertBefore(n, e), n;
    }
  },
  oo = (e) => {
    e.qwik = { pause: () => v$(e), state: be(e) };
  },
  $o = (e) => {
    const t = e.indexOf("q:id=");
    return t > 0 ? Y(e.slice(t + 5)) : -1;
  },
  Ss = () => {
    const e = No();
    let t = e.$qrl$;
    if (t) t.$captureRef$;
    else {
      const n = e.$element$, s = xt(n);
      t = wt(decodeURIComponent(String(e.$url$)), s), ms(s);
      const r = O(n, be(s));
      Ys(t, r);
    }
    return t.$captureRef$;
  },
  io = (e, t) => {
    try {
      const n = t[0], s = e.$static$;
      switch (n) {
        case 1:
        case 2: {
          let r, o;
          n === 1 ? (r = t[1], o = t[3]) : (r = t[3], o = t[1]);
          const $ = B(r);
          if ($ == null) return;
          const c = t[4], i = r.namespaceURI === et;
          s.$containerState$.$subsManager$.$clearSignal$(t);
          let l = ve(t[2], t.slice(0, -1));
          c === "class" ? l = on(l, B(o)) : c === "style" && (l = $n(l));
          const a = un($);
          return c in a.$props$ && a.$props$[c] === l
            ? void 0
            : (a.$props$[c] = l, yn(s, r, c, l, i));
        }
        case 3:
        case 4: {
          const r = t[3];
          if (!s.$visited$.includes(r)) {
            s.$containerState$.$subsManager$.$clearSignal$(t);
            const o = void 0;
            let $ = ve(t[2], t.slice(0, -1));
            const c = yi();
            Array.isArray($) && ($ = new Ze(Be, {}, null, $, 0, null));
            let i = oe($, o);
            if (V(i)) Se("Rendering promises in JSX signals is not supported");
            else {
              i === void 0 && (i = oe("", o));
              const l = zs(r), a = co(t[1]);
              if (
                e.$cmpCtx$ = O(a, e.$static$.$containerState$),
                  l.$type$ == i.$type$ && l.$key$ == i.$key$ && l.$id$ == i.$id$
              ) Te(e, l, i, 0);
              else {
                const f = [], h = l.$elm$, p = me(e, i, 0, f);
                f.length &&
                Se("Rendering promises in JSX signals is not supported"),
                  c[3] = p,
                  Ne(e.$static$, r.parentElement, p, h),
                  h && En(s, h);
              }
            }
          }
        }
      }
    } catch {}
  };
function co(e) {
  for (; e;) {
    if (le(e)) return e;
    e = e.parentElement;
  }
  throw new Error("Not found");
}
const lo = (e, t) => {
    if (e[0] === 0) {
      const n = e[1];
      pn(n) ? fn(n, t) : ao(n, t);
    } else uo(e, t);
  },
  ao = (e, t) => {
    ms(t.$containerEl$);
    const n = O(e, t);
    n.$componentQrl$,
      !(n.$flags$ & Ue) &&
      (n.$flags$ |= Ue,
        t.$hostsRendering$ !== void 0
          ? t.$hostsStaging$.add(n)
          : (t.$hostsNext$.add(n), dn(t)));
  },
  uo = (e, t) => {
    const n = t.$hostsRendering$ !== void 0;
    t.$opsNext$.add(e), n || dn(t);
  },
  fn = (e, t) => {
    e.$flags$ & ye ||
      (e.$flags$ |= ye,
        t.$hostsRendering$ !== void 0
          ? t.$taskStaging$.add(e)
          : (t.$taskNext$.add(e), dn(t)));
  },
  dn = (e) => (e.$renderPromise$ === void 0 &&
    (e.$renderPromise$ = Xt().nextTick(() => vs(e))),
    e.$renderPromise$),
  ys = () => {
    const [e] = Ss();
    fn(e, be(xt(e.$el$)));
  },
  vs = async (e) => {
    const t = e.$containerEl$, n = Ye(t);
    try {
      const s = Gr(n, e),
        r = s.$static$,
        o = e.$hostsRendering$ = new Set(e.$hostsNext$);
      e.$hostsNext$.clear(),
        await po(e, s),
        e.$hostsStaging$.forEach((i) => {
          o.add(i);
        }),
        e.$hostsStaging$.clear();
      const $ = Array.from(e.$opsNext$);
      e.$opsNext$.clear();
      const c = Array.from(o);
      go(c),
        !e.$styleMoved$ && c.length > 0 &&
        (e.$styleMoved$ = !0,
          (t === n.documentElement ? n.body : t).querySelectorAll(
            "style[q\\:style]",
          ).forEach((i) => {
            e.$styleIds$.add(K(i, Kt)), Hs(r, n.head, i);
          }));
      for (const i of c) {
        const l = i.$element$;
        if (!r.$hostElements$.has(l) && i.$componentQrl$) {
          l.isConnected, r.$roots$.push(i);
          try {
            await an(s, i, fo(l.parentElement));
          } catch (a) {
            Se(a);
          }
        }
      }
      return $.forEach((i) => {
        io(s, i);
      }),
        r.$operations$.push(...r.$postOperations$),
        r.$operations$.length === 0
          ? (Hn(r), void await qn(e, s))
          : (await Zo(r), Hn(r), qn(e, s));
    } catch (s) {
      Se(s);
    }
  },
  fo = (e) => {
    let t = 0;
    return e &&
      (e.namespaceURI === et && (t |= D), e.tagName === "HEAD" && (t |= $t)),
      t;
  },
  qn = async (e, t) => {
    const n = t.$static$.$hostElements$;
    await mo(e, t, (s, r) => !!(s.$flags$ & Es) && (!r || n.has(s.$el$))),
      e.$hostsStaging$.forEach((s) => {
        e.$hostsNext$.add(s);
      }),
      e.$hostsStaging$.clear(),
      e.$hostsRendering$ = void 0,
      e.$renderPromise$ = void 0,
      e.$hostsNext$.size + e.$taskNext$.size + e.$opsNext$.size > 0 &&
      (e.$renderPromise$ = vs(e));
  },
  qt = (e) => !!(e.$flags$ & xs),
  kn = (e) => !!(e.$flags$ & bs),
  po = async (e, t) => {
    const n = e.$containerEl$, s = [], r = [];
    e.$taskNext$.forEach((o) => {
      qt(o) &&
      (r.push(A(o.$qrl$.$resolveLazy$(n), () => o)), e.$taskNext$.delete(o)),
        kn(o) &&
        (s.push(A(o.$qrl$.$resolveLazy$(n), () => o)), e.$taskNext$.delete(o));
    });
    do if (
      e.$taskStaging$.forEach((o) => {
        qt(o)
          ? r.push(A(o.$qrl$.$resolveLazy$(n), () => o))
          : kn(o)
          ? s.push(A(o.$qrl$.$resolveLazy$(n), () => o))
          : e.$taskNext$.add(o);
      }),
        e.$taskStaging$.clear(),
        r.length > 0
    ) {
      const o = await Promise.all(r);
      rt(o), await Promise.all(o.map(($) => ot($, e, t))), r.length = 0;
    } while (e.$taskStaging$.size > 0);
    if (s.length > 0) {
      const o = await Promise.all(s);
      rt(o);
      for (const $ of o) ot($, e, t);
    }
  },
  ho = (e, t) => {
    const n = e.$containerEl$, s = e.$taskStaging$;
    if (!s.size) return;
    const r = [];
    let o = 20;
    const $ = () => {
      if (
        s.forEach((c) => {
          qt(c) && r.push(A(c.$qrl$.$resolveLazy$(n), () => c));
        }),
          s.clear(),
          r.length > 0
      ) {
        return Promise.all(r).then(async (c) => {
          if (
            rt(c),
              await Promise.all(c.map((i) => ot(i, e, t))),
              r.length = 0,
              --o && s.size > 0
          ) return $();
          o || ke(`Infinite task loop detected. Tasks:
${
            Array.from(s).map((i) => `  ${i.$qrl$.$symbol$}`).join(`
`)
          }`);
        });
      }
    };
    return $();
  },
  mo = async (e, t, n) => {
    const s = [], r = e.$containerEl$;
    e.$taskNext$.forEach((o) => {
      n(o, !1) &&
        (o.$el$.isConnected && s.push(A(o.$qrl$.$resolveLazy$(r), () => o)),
          e.$taskNext$.delete(o));
    });
    do if (
      e.$taskStaging$.forEach((o) => {
        o.$el$.isConnected &&
          (n(o, !0)
            ? s.push(A(o.$qrl$.$resolveLazy$(r), () => o))
            : e.$taskNext$.add(o));
      }),
        e.$taskStaging$.clear(),
        s.length > 0
    ) {
      const o = await Promise.all(s);
      rt(o);
      for (const $ of o) ot($, e, t);
      s.length = 0;
    } while (e.$taskStaging$.size > 0);
  },
  go = (e) => {
    e.sort((t, n) =>
      2 & t.$element$.compareDocumentPosition(ut(n.$element$)) ? 1 : -1
    );
  },
  rt = (e) => {
    e.sort((t, n) =>
      t.$el$ === n.$el$
        ? t.$index$ < n.$index$ ? -1 : 1
        : 2 & t.$el$.compareDocumentPosition(ut(n.$el$))
        ? 1
        : -1
    );
  },
  So = (e) => {
    const t = Po(), n = U(e) && !An(e) ? G(void 0, e) : e;
    return zo(n, t, 0);
  },
  yo = (e) => {
    const { val: t, set: n } = xe();
    return t ?? n(e = U(e) && !An(e) ? e() : e);
  },
  Xi = (e) => yo(() => So(e)),
  Es = 1,
  xs = 2,
  bs = 4,
  ye = 16,
  Vi = (e, t) => {
    const { val: n, set: s, iCtx: r, i: o, elCtx: $ } = xe();
    if (n) return;
    const c = r.$renderCtx$.$static$.$containerState$,
      i = new Et(ye | xs, o, $.$element$, e, void 0);
    s(!0),
      e.$resolveLazy$(c.$containerEl$),
      $.$tasks$ || ($.$tasks$ = []),
      $.$tasks$.push(i),
      qo(r, () => _s(i, c, r.$renderCtx$));
  },
  Ki = (e, t) => {
    const { val: n, set: s, i: r, iCtx: o, elCtx: $ } = xe(),
      c = (t == null ? void 0 : t.strategy) ?? "intersection-observer";
    if (n) return void ht();
    const i = new Et(Es, r, $.$element$, e, void 0),
      l = o.$renderCtx$.$static$.$containerState$;
    $.$tasks$ || ($.$tasks$ = []),
      $.$tasks$.push(i),
      s(i),
      bo(i, c),
      e.$resolveLazy$(l.$containerEl$),
      fn(i, l);
  },
  ws = (e) => !!(e.$flags$ & bs),
  vo = (e) => !!(8 & e.$flags$),
  ot = async (
    e,
    t,
    n,
  ) => (e.$flags$ & ye,
    ws(e) ? Eo(e, t, n) : vo(e) ? xo(e, t, n) : _s(e, t, n)),
  Eo = (e, t, n, s) => {
    e.$flags$ &= ~ye, He(e);
    const r = J(n.$static$.$locale$, e.$el$, void 0, "qTask"),
      { $subsManager$: o } = t;
    r.$renderCtx$ = n;
    const $ = e.$qrl$.getFn(r, () => {
        o.$clearSub$(e);
      }),
      c = [],
      i = e.$state$,
      l = Tt(i),
      a = {
        track: (u, g) => {
          if (U(u)) {
            const d = J();
            return d.$renderCtx$ = n, d.$subscriber$ = [0, e], G(d, u);
          }
          const v = z(u);
          return v ? v.$addSub$([0, e], g) : Gt(pt(26), u),
            g ? u[g] : X(u) ? u.value : u;
        },
        cleanup(u) {
          c.push(u);
        },
        cache(u) {
          let g = 0;
          g = u === "immutable" ? 1 / 0 : u, i._cache = g;
        },
        previous: l._resolved,
      };
    let f, h, p = !1;
    const m = (u, g) =>
      !p &&
      (p = !0,
        u
          ? (p = !0,
            i.loading = !1,
            i._state = "resolved",
            i._resolved = g,
            i._error = void 0,
            f(g))
          : (p = !0, i.loading = !1, i._state = "rejected", i._error = g, h(g)),
        !0);
    G(r, () => {
      i._state = "pending",
        i.loading = !ht(),
        i.value = new Promise((u, g) => {
          f = u, h = g;
        });
    }),
      e.$destroy$ = rr(() => {
        p = !0, c.forEach((u) => u());
      });
    const S = gt(() => A(s, () => $(a)), (u) => {
        m(!0, u);
      }, (u) => {
        m(!1, u);
      }),
      y = l._timeout;
    return y > 0
      ? Promise.race([
        S,
        wr(y).then(() => {
          m(!1, new Error("timeout")) && He(e);
        }),
      ])
      : S;
  },
  _s = (e, t, n) => {
    e.$flags$ &= ~ye, He(e);
    const s = e.$el$, r = J(n.$static$.$locale$, s, void 0, "qTask");
    r.$renderCtx$ = n;
    const { $subsManager$: o } = t,
      $ = e.$qrl$.getFn(r, () => {
        o.$clearSub$(e);
      }),
      c = [];
    e.$destroy$ = rr(() => {
      c.forEach((l) => l());
    });
    const i = {
      track: (l, a) => {
        if (U(l)) {
          const h = J();
          return h.$subscriber$ = [0, e], G(h, l);
        }
        const f = z(l);
        return f ? f.$addSub$([0, e], a) : Gt(pt(26), l),
          a ? l[a] : X(l) ? l.value : l;
      },
      cleanup(l) {
        c.push(l);
      },
    };
    return gt(() => $(i), (l) => {
      U(l) && c.push(l);
    }, (l) => {
      sn(l, s, n);
    });
  },
  xo = (e, t, n) => {
    e.$state$, e.$flags$ &= ~ye, He(e);
    const s = e.$el$, r = J(n.$static$.$locale$, s, void 0, "qComputed");
    r.$subscriber$ = [0, e], r.$renderCtx$ = n;
    const { $subsManager$: o } = t,
      $ = e.$qrl$.getFn(r, () => {
        o.$clearSub$(e);
      });
    return gt($, (c) =>
      ko(() => {
        const i = e.$state$;
        i[Ge] &= ~Ms, i.untrackedValue = c, i[Z].$notifySubs$();
      }), (c) => {
      sn(c, s, n);
    });
  },
  He = (e) => {
    const t = e.$destroy$;
    if (t) {
      e.$destroy$ = void 0;
      try {
        t();
      } catch (n) {
        Se(n);
      }
    }
  },
  Ts = (e) => {
    32 & e.$flags$ ? (e.$flags$ &= -33, (0, e.$qrl$)()) : He(e);
  },
  bo = (e, t) => {
    t === "visible" || t === "intersection-observer"
      ? Pr("qvisible", At(e))
      : t === "load" || t === "document-ready"
      ? Rn("qinit", At(e))
      : t !== "idle" && t !== "document-idle" || Rn("qidle", At(e));
  },
  At = (e) => {
    const t = e.$qrl$,
      n = nt(t.$chunk$, "_hW", ys, null, null, [e], t.$symbol$);
    return t.dev && (n.dev = t.dev), n;
  },
  pn = (e) => ae(e) && e instanceof Et,
  wo = (e, t) => {
    let n = `${$e(e.$flags$)} ${$e(e.$index$)} ${t(e.$qrl$)} ${t(e.$el$)}`;
    return e.$state$ && (n += ` ${t(e.$state$)}`), n;
  },
  _o = (e) => {
    const [t, n, s, r, o] = e.split(" ");
    return new Et(Y(t), Y(n), r, s, o);
  };
class Et {
  constructor(t, n, s, r, o) {
    this.$flags$ = t,
      this.$index$ = n,
      this.$el$ = s,
      this.$qrl$ = r,
      this.$state$ = o;
  }
}
function To(e) {
  return Ao(e) && e.nodeType === 1;
}
function Ao(e) {
  return e && typeof e.nodeType == "number";
}
const Ue = 1,
  kt = 2,
  hn = 4,
  As = 8,
  B = (e) => e[Yt],
  O = (e, t) => {
    const n = B(e);
    if (n) return n;
    const s = mn(e), r = K(e, "q:id");
    if (r) {
      const o = t.$pauseCtx$;
      if (s.$id$ = r, o) {
        const { getObject: $, meta: c, refs: i } = o;
        if (To(e)) {
          const l = i[r];
          l &&
            (s.$refMap$ = l.split(" ").map($), s.li = Nr(s, t.$containerEl$));
        } else {
          const l = e.getAttribute("q:sstyle");
          s.$scopeIds$ = l ? l.split("|") : null;
          const a = c[r];
          if (a) {
            const f = a.s, h = a.h, p = a.c, m = a.w;
            if (
              f && (s.$seq$ = f.split(" ").map($)),
                m && (s.$tasks$ = m.split(" ").map($)),
                p
            ) {
              s.$contexts$ = new Map();
              for (const S of p.split(" ")) {
                const [y, u] = S.split("=");
                s.$contexts$.set(y, $(u));
              }
            }
            if (h) {
              const [S, y] = h.split(" ");
              if (s.$flags$ = hn, S && (s.$componentQrl$ = $(S)), y) {
                const u = $(y);
                s.$props$ = u, yt(u, 2), u[N] = Io(u);
              } else s.$props$ = St(nn(), t);
            }
          }
        }
      }
    }
    return s;
  },
  Io = (e) => {
    const t = {}, n = we(e);
    for (const s in n) s.startsWith("$$") && (t[s.slice(2)] = n[s]);
    return t;
  },
  mn = (e) => {
    const t = {
      $flags$: 0,
      $id$: "",
      $element$: e,
      $refMap$: [],
      li: [],
      $tasks$: null,
      $seq$: null,
      $slots$: null,
      $scopeIds$: null,
      $appendStyles$: null,
      $props$: null,
      $vdom$: null,
      $componentQrl$: null,
      $contexts$: null,
      $dynamicSlots$: null,
      $parentCtx$: void 0,
      $realParentCtx$: void 0,
    };
    return e[Yt] = t, t;
  },
  Co = (e, t) => {
    var n;
    (n = e.$tasks$) == null || n.forEach((s) => {
      t.$clearSub$(s), Ts(s);
    }),
      e.$componentQrl$ = null,
      e.$seq$ = null,
      e.$tasks$ = null;
  };
let Pe;
function Yi(e) {
  if (Pe === void 0) {
    const t = W();
    return t && t.$locale$ ? t.$locale$ : e;
  }
  return Pe;
}
function Zi(e, t) {
  const n = Pe;
  try {
    return Pe = e, t();
  } finally {
    Pe = n;
  }
}
function Mo(e) {
  Pe = e;
}
let Qe;
const W = () => {
    if (!Qe) {
      const e = typeof document < "u" && document && document.__q_context__;
      return e ? R(e) ? document.__q_context__ = Is(e) : e : void 0;
    }
    return Qe;
  },
  No = () => {
    const e = W();
    if (!e) throw M(14);
    return e;
  },
  gn = () => {
    const e = W();
    if (!e || e.$event$ !== "qRender") throw M(20);
    return e.$hostElement$, e.$waitOn$, e.$renderCtx$, e.$subscriber$, e;
  },
  Po = () => gn().$renderCtx$.$static$.$containerState$;
function G(e, t, ...n) {
  return Ro.call(this, e, t, n);
}
function Ro(e, t, n) {
  const s = Qe;
  let r;
  try {
    Qe = e, r = t.apply(this, n);
  } finally {
    Qe = s;
  }
  return r;
}
const qo = (e, t) => {
    const n = e.$waitOn$;
    if (n.length === 0) {
      const s = t();
      V(s) && n.push(s);
    } else n.push(Promise.all(n).then(t));
  },
  Is = ([e, t, n]) => {
    const s = e.closest("[q\\:container]"),
      r = (s == null ? void 0 : s.getAttribute("q:locale")) || void 0;
    return r && Mo(r), J(r, void 0, e, t, n);
  },
  J = (e, t, n, s, r) => ({
    $url$: r,
    $i$: 0,
    $hostElement$: t,
    $element$: n,
    $event$: s,
    $qrl$: void 0,
    $waitOn$: void 0,
    $subscriber$: void 0,
    $renderCtx$: void 0,
    $locale$: e ||
      (typeof s == "object" && s && "locale" in s ? s.locale : void 0),
  }),
  xt = (e) => e.closest("[q\\:container]"),
  ko = (e) => G(void 0, e),
  zn = J(void 0, void 0, void 0, "qRender"),
  ve = (e, t) => (zn.$subscriber$ = t, G(zn, () => e.value)),
  ji = () => {
    var t;
    const e = W();
    if (e) {
      return e.$element$ ?? e.$hostElement$ ??
        ((t = e.$qrl$) == null ? void 0 : t.$setContainer$(void 0));
    }
  },
  ec = (e) => {
    const t = W();
    return t && t.$hostElement$ && t.$renderCtx$ &&
      (O(t.$hostElement$, t.$renderCtx$.$static$.$containerState$).$flags$ |=
        As),
      e;
  },
  tc = (e) => {
    const t = xt(e);
    return t ? be(t).$renderPromise$ ?? Promise.resolve() : Promise.resolve();
  };
var Cs;
const zo = (e, t, n, s) => {
    const r = t.$subsManager$.$createManager$(s);
    return new Je(e, r, n);
  },
  Ge = Symbol("proxy manager"),
  Oo = 1,
  Ms = 2,
  Ns = Symbol("unassigned signal");
class je {}
class Je extends je {
  constructor(t, n, s) {
    super(), this[Cs] = 0, this.untrackedValue = t, this[Z] = n, this[Ge] = s;
  }
  valueOf() {}
  toString() {
    return `[Signal ${String(this.value)}]`;
  }
  toJSON() {
    return { value: this.value };
  }
  get value() {
    var n;
    if (this[Ge] & Ms) throw Ns;
    const t = (n = W()) == null ? void 0 : n.$subscriber$;
    return t && this[Z].$addSub$(t), this.untrackedValue;
  }
  set value(t) {
    const n = this[Z];
    n && this.untrackedValue !== t &&
      (this.untrackedValue = t, n.$notifySubs$());
  }
}
Cs = Ge;
class zt extends je {
  constructor(t, n, s) {
    super(), this.$func$ = t, this.$args$ = n, this.$funcStr$ = s;
  }
  get value() {
    return this.$func$.apply(void 0, this.$args$);
  }
}
class Ot extends je {
  constructor(t, n) {
    super(), this.ref = t, this.prop = n;
  }
  get [Z]() {
    return z(this.ref);
  }
  get value() {
    return this.ref[this.prop];
  }
  set value(t) {
    this.ref[this.prop] = t;
  }
}
const X = (e) => e instanceof je,
  Lo = (e, t) => {
    var r, o;
    if (!ae(e)) return e[t];
    if (e instanceof je) return e;
    const n = we(e);
    if (n) {
      const $ = n["$$" + t];
      if ($) return $;
      if (((r = n[N]) == null ? void 0 : r[t]) !== !0) return new Ot(e, t);
    }
    const s = (o = e[N]) == null ? void 0 : o[t];
    return X(s) ? s : N;
  },
  nc = (e, t) => {
    const n = Lo(e, t);
    return n === N ? e[t] : n;
  },
  On = Symbol("ContainerState"),
  be = (e) => {
    let t = e[On];
    return t || (e[On] = t = Ps(e, K(e, "q:base") ?? "/")), t;
  },
  Ps = (e, t) => {
    const n = {};
    if (e) {
      const r = e.attributes;
      if (r) {
        for (let o = 0; o < r.length; o++) {
          const $ = r[o];
          n[$.name] = $.value;
        }
      }
    }
    const s = {
      $containerEl$: e,
      $elementIndex$: 0,
      $styleMoved$: !1,
      $proxyMap$: new WeakMap(),
      $opsNext$: new Set(),
      $taskNext$: new Set(),
      $taskStaging$: new Set(),
      $hostsNext$: new Set(),
      $hostsStaging$: new Set(),
      $styleIds$: new Set(),
      $events$: new Set(),
      $serverData$: { containerAttributes: n },
      $base$: t,
      $renderPromise$: void 0,
      $hostsRendering$: void 0,
      $pauseCtx$: void 0,
      $subsManager$: null,
      $inlineFns$: new Map(),
    };
    return s.$subsManager$ = gi(s), s;
  },
  Rs = (e, t) => {
    if (U(e)) return e(t);
    if (X(e)) return e.value = t;
    throw M(32, e);
  },
  qs = 128,
  Do = (e) => ce(e) && e.hasAttribute("q:container"),
  $e = (e) => e.toString(36),
  Y = (e) => parseInt(e, 36),
  Fo = (e) => {
    const t = e.indexOf(":");
    return e && Tr(e.slice(t + 1));
  },
  et = "http://www.w3.org/2000/svg",
  D = 1,
  $t = 2,
  it = [],
  ct = (e, t, n, s) => {
    t.$elm$;
    const r = n.$children$;
    if (r.length === 1 && r[0].$type$ === ":skipRender") {
      return void (n.$children$ = t.$children$);
    }
    const o = t.$elm$;
    let $ = at;
    t.$children$ === it && o.nodeName === "HEAD" && ($ = Bo, s |= $t);
    const c = Qo(t, $);
    return c.length > 0 && r.length > 0
      ? Wo(e, o, c, r, s)
      : c.length > 0 && r.length === 0
      ? Sn(e.$static$, c, 0, c.length - 1)
      : r.length > 0
      ? Ls(e, o, null, r, 0, r.length - 1, s)
      : void 0;
  },
  Qo = (e, t) => {
    const n = e.$children$;
    return n === it ? e.$children$ = ks(e.$elm$, t) : n;
  },
  Wo = (e, t, n, s, r) => {
    let o = 0,
      $ = 0,
      c = n.length - 1,
      i = n[0],
      l = n[c],
      a = s.length - 1,
      f = s[0],
      h = s[a],
      p,
      m,
      S;
    const y = [], u = e.$static$;
    for (; o <= c && $ <= a;) {
      if (i == null) i = n[++o];
      else if (l == null) l = n[--c];
      else if (f == null) f = s[++$];
      else if (h == null) h = s[--a];
      else if (i.$id$ === f.$id$) {
        y.push(Te(e, i, f, r)), i = n[++o], f = s[++$];
      } else if (l.$id$ === h.$id$) {
        y.push(Te(e, l, h, r)), l = n[--c], h = s[--a];
      } else if (i.$key$ && i.$id$ === h.$id$) {
        i.$elm$,
          l.$elm$,
          y.push(Te(e, i, h, r)),
          r$(u, t, i.$elm$, l.$elm$),
          i = n[++o],
          h = s[--a];
      } else if (l.$key$ && l.$id$ === f.$id$) {
        i.$elm$,
          l.$elm$,
          y.push(Te(e, l, f, r)),
          Ne(u, t, l.$elm$, i.$elm$),
          l = n[--c],
          f = s[++$];
      } else {
        if (p === void 0 && (p = t$(n, o, c)), m = p[f.$key$], m === void 0) {
          const v = me(e, f, r, y);
          Ne(u, t, v, i == null ? void 0 : i.$elm$);
        } else if (S = n[m], S.$type$ !== f.$type$) {
          const v = me(e, f, r, y);
          A(v, (d) => {
            Ne(u, t, d, i == null ? void 0 : i.$elm$);
          });
        } else {y.push(Te(e, S, f, r)),
            n[m] = void 0,
            S.$elm$,
            Ne(u, t, S.$elm$, i.$elm$);}
        f = s[++$];
      }
    }
    $ <= a &&
      y.push(Ls(e, t, s[a + 1] == null ? null : s[a + 1].$elm$, s, $, a, r));
    let g = Vt(y);
    return o <= c && (g = A(g, () => {
      Sn(u, n, o, c);
    })),
      g;
  },
  Me = (e, t) => {
    const n = j(e) ? e.close : null, s = [];
    let r = e.firstChild;
    for (; (r = xn(r)) && (t(r) && s.push(r), r = r.nextSibling, r !== n););
    return s;
  },
  ks = (e, t) => Me(e, t).map(zs),
  zs = (e) => {
    var t;
    return ce(e) ? ((t = B(e)) == null ? void 0 : t.$vdom$) ?? lt(e) : lt(e);
  },
  lt = (e) => {
    if (le(e)) {
      const t = new se(e.localName, {}, null, it, 0, Dt(e));
      return t.$elm$ = e, t;
    }
    if (Ut(e)) {
      const t = new se(e.nodeName, F, null, it, 0, null);
      return t.$text$ = e.data, t.$elm$ = e, t;
    }
  },
  Bo = (e) => {
    const t = e.nodeType;
    return t === 1 ? e.hasAttribute("q:head") : t === 111;
  },
  Lt = (e) => e.nodeName === "Q:TEMPLATE",
  at = (e) => {
    const t = e.nodeType;
    if (t === 3 || t === 111) return !0;
    if (t !== 1) return !1;
    const n = e.nodeName;
    return n !== "Q:TEMPLATE" &&
      (n === "HEAD"
        ? e.hasAttribute("q:head")
        : n !== "STYLE" || !e.hasAttribute(Kt));
  },
  Os = (e) => {
    const t = {};
    for (const n of e) {
      const s = Ho(n);
      (t[s] ?? (t[s] = new se(ze, { [rs]: "" }, null, [], 0, s))).$children$
        .push(n);
    }
    return t;
  },
  Te = (e, t, n, s) => {
    t.$type$, n.$type$, t.$key$, n.$key$, t.$id$, n.$id$;
    const r = t.$elm$,
      o = n.$type$,
      $ = e.$static$,
      c = $.$containerState$,
      i = e.$cmpCtx$;
    if (n.$elm$ = r, o === "#text") {
      $.$visited$.push(r);
      const h = n.$signal$;
      return h && (n.$text$ = cn(ve(h, [4, i.$element$, h, r]))),
        void ie($, r, "data", n.$text$);
    }
    if (o === "#signal") return;
    const l = n.$props$, a = n.$flags$, f = O(r, c);
    if (o !== ze) {
      let h = !!(s & D);
      if (h || o !== "svg" || (s |= D, h = !0), l !== F) {
        1 & a || (f.li.length = 0);
        const p = t.$props$;
        n.$props$ = p;
        for (const m in l) {
          let S = l[m];
          if (m !== "ref") {
            if (is(m)) {
              const y = cs(f.li, m, S, c.$containerEl$);
              Qs($, r, y);
            } else {X(S) && (S = ve(S, [1, i.$element$, S, r, m])),
                m === "class" ? S = on(S, i) : m === "style" && (S = $n(S)),
                p[m] !== S && (p[m] = S, yn($, r, m, S, h));}
          } else S !== void 0 && Rs(S, r);
        }
      }
      return 2 & a ||
          (h && o === "foreignObject" && (s &= ~D), l[he] !== void 0) ||
          o === "textarea"
        ? void 0
        : ct(e, t, n, s);
    }
    if ("q:renderFn" in l) {
      const h = l.props;
      Yo(c, f, h);
      let p = !!(f.$flags$ & Ue);
      return p || f.$componentQrl$ || f.$element$.hasAttribute("q:id") ||
        (us(e, f),
          f.$componentQrl$ = h["q:renderFn"],
          f.$componentQrl$,
          p = !0),
        p ? A(an(e, f, s), () => Ln(e, f, n, s)) : Ln(e, f, n, s);
    }
    if ("q:s" in l) return i.$slots$, void i.$slots$.push(n);
    if (he in l) ie($, r, "innerHTML", l[he]);
    else if (!(2 & a)) return ct(e, t, n, s);
  },
  Ln = (e, t, n, s) => {
    if (2 & n.$flags$) return;
    const r = e.$static$, o = Os(n.$children$), $ = Fs(t);
    for (const c in $.slots) {
      if (!o[c]) {
        const i = $.slots[c], l = ks(i, at);
        if (l.length > 0) {
          const a = B(i);
          a && a.$vdom$ && (a.$vdom$.$children$ = []),
            Sn(r, l, 0, l.length - 1);
        }
      }
    }
    for (const c in $.templates) {
      const i = $.templates[c];
      i && !o[c] && ($.templates[c] = void 0, En(r, i));
    }
    return Vt(
      Object.keys(o).map((c) => {
        const i = o[c],
          l = Ds(r, $, t, c, e.$static$.$containerState$),
          a = un(l),
          f = rn(e),
          h = l.$element$;
        f.$slotCtx$ = l, l.$vdom$ = i, i.$elm$ = h;
        let p = s & ~D;
        h.isSvg && (p |= D);
        const m = r.$addSlots$.findIndex((S) => S[0] === h);
        return m >= 0 && r.$addSlots$.splice(m, 1), ct(f, a, i, p);
      }),
    );
  },
  Ls = (e, t, n, s, r, o, $) => {
    const c = [];
    for (; r <= o; ++r) {
      const i = s[r], l = me(e, i, $, c);
      Ne(e.$static$, t, l, n);
    }
    return Ie(c);
  },
  Sn = (e, t, n, s) => {
    for (; n <= s; ++n) {
      const r = t[n];
      r && (r.$elm$, En(e, r.$elm$));
    }
  },
  Ds = (e, t, n, s, r) => {
    const o = t.slots[s];
    if (o) return O(o, r);
    const $ = t.templates[s];
    if ($) return O($, r);
    const c = Us(e.$doc$, s), i = mn(c);
    return i.$parentCtx$ = n, i$(e, n.$element$, c), t.templates[s] = c, i;
  },
  Ho = (e) => e.$props$[re] ?? "",
  me = (e, t, n, s) => {
    const r = t.$type$, o = e.$static$.$doc$, $ = e.$cmpCtx$;
    if (r === "#text") return t.$elm$ = o.createTextNode(t.$text$);
    if (r === "#signal") {
      const y = t.$signal$, u = y.value;
      if (vt(u)) {
        const g = oe(u);
        if (X(g)) throw new Error("NOT IMPLEMENTED: Promise");
        if (Array.isArray(g)) throw new Error("NOT IMPLEMENTED: Array");
        {
          const v = me(e, g, n, s);
          return ve(y, 4 & n ? [3, v, y, v] : [4, $.$element$, y, v]),
            t.$elm$ = v;
        }
      }
      {
        const g = o.createTextNode(t.$text$);
        return g.data = t.$text$ = cn(u),
          ve(y, 4 & n ? [3, g, y, g] : [4, $.$element$, y, g]),
          t.$elm$ = g;
      }
    }
    let c, i = !!(n & D);
    i || r !== "svg" || (n |= D, i = !0);
    const l = r === ze, a = t.$props$, f = e.$static$, h = f.$containerState$;
    l
      ? c = f$(o, i)
      : r === "head"
      ? (c = o.head, n |= $t)
      : (c = vn(o, r, i), n &= ~$t),
      2 & t.$flags$ && (n |= 4),
      t.$elm$ = c;
    const p = mn(c);
    if (
      e.$slotCtx$
        ? (p.$parentCtx$ = e.$slotCtx$, p.$realParentCtx$ = e.$cmpCtx$)
        : p.$parentCtx$ = e.$cmpCtx$, l
    ) {
      if ("q:renderFn" in a) {
        const y = a["q:renderFn"],
          u = nn(),
          g = h.$subsManager$.$createManager$(),
          v = new Proxy(u, new ls(h, g)),
          d = a.props;
        if (h.$proxyMap$.set(u, v), p.$props$ = v, d !== F) {
          const b = u[N] = d[N] ?? F;
          for (const _ in d) {
            if (_ !== "children" && _ !== re) {
              const w = b[_];
              X(w) ? u["$$" + _] = w : u[_] = d[_];
            }
          }
        }
        us(e, p), p.$componentQrl$ = y;
        const x = A(an(e, p, n), () => {
          let b = t.$children$;
          if (b.length === 0) return;
          b.length === 1 && b[0].$type$ === ":skipRender" &&
            (b = b[0].$children$);
          const _ = Fs(p), w = [], C = Os(b);
          for (const k in C) {
            const H = C[k],
              ue = Ds(f, _, p, k, f.$containerState$),
              ee = rn(e),
              _e = ue.$element$;
            ee.$slotCtx$ = ue, ue.$vdom$ = H, H.$elm$ = _e;
            let L = n & ~D;
            _e.isSvg && (L |= D);
            for (const P of H.$children$) {
              const De = me(ee, P, L, w);
              P.$elm$, P.$elm$, Hs(f, _e, De);
            }
          }
          return Ie(w);
        });
        return V(x) && s.push(x), c;
      }
      if ("q:s" in a) {
        $.$slots$,
          a$(c, t.$key$),
          Q(c, "q:sref", $.$id$),
          Q(c, "q:s", ""),
          $.$slots$.push(t),
          f.$addSlots$.push([c, $.$element$]);
      } else if (he in a) return ie(f, c, "innerHTML", a[he]), c;
    } else {
      if (t.$immutableProps$) {
        const y = a !== F
          ? Object.fromEntries(
            Object.entries(t.$immutableProps$).map((
              [u, g],
            ) => [u, g === N ? a[u] : g]),
          )
          : t.$immutableProps$;
        Qn(f, p, $, y, i, !0);
      }
      if (a !== F) {
        p.$vdom$ = t;
        const y = t.$immutableProps$
          ? Object.fromEntries(
            Object.entries(a).filter(([u]) => !(u in t.$immutableProps$)),
          )
          : a;
        t.$props$ = Qn(f, p, $, y, i, !1);
      }
      if (i && r === "foreignObject" && (i = !1, n &= ~D), $) {
        const y = $.$scopeIds$;
        y && y.forEach((u) => {
          c.classList.add(u);
        }), $.$flags$ & kt && (p.li.push(...$.li), $.$flags$ &= ~kt);
      }
      for (const y of p.li) Qs(f, c, y[0]);
      if (a[he] !== void 0) return c;
      i && r === "foreignObject" && (i = !1, n &= ~D);
    }
    let m = t.$children$;
    if (m.length === 0) return c;
    m.length === 1 && m[0].$type$ === ":skipRender" && (m = m[0].$children$);
    const S = m.map((y) => me(e, y, n, s));
    for (const y of S) Xe(c, y);
    return c;
  },
  Uo = (e) => {
    const t = e.$slots$;
    return t || (e.$element$.parentElement, e.$slots$ = Go(e));
  },
  Fs = (e) => {
    const t = Uo(e),
      n = {},
      s = {},
      r = Array.from(e.$element$.childNodes).filter(Lt);
    for (const o of t) o.$elm$, n[o.$key$ ?? ""] = o.$elm$;
    for (const o of r) s[K(o, re) ?? ""] = o;
    return { slots: n, templates: s };
  },
  Go = (e) => {
    const t = e.$element$.parentElement;
    return m$(t, "q:sref", e.$id$).map(lt);
  },
  Jo = (e, t, n) => (ie(e, t.style, "cssText", n), !0),
  Dn = (
    e,
    t,
    n,
  ) => (t.namespaceURI === et ? Ve(e, t, "class", n) : ie(e, t, "className", n),
    !0),
  Fn = (e, t, n, s) =>
    s in t &&
    ((t[s] !== n || s === "value" && !t.hasAttribute(s)) &&
      (s === "value" && t.tagName !== "OPTION"
        ? s$(e, t, s, n)
        : ie(e, t, s, n)),
      !0),
  Fe = (e, t, n, s) => (Ve(e, t, s.toLowerCase(), n), !0),
  Xo = (e, t, n) => (ie(e, t, "innerHTML", n), !0),
  Vo = () => !0,
  Ko = {
    style: Jo,
    class: Dn,
    className: Dn,
    value: Fn,
    checked: Fn,
    href: Fe,
    list: Fe,
    form: Fe,
    tabIndex: Fe,
    download: Fe,
    innerHTML: Vo,
    [he]: Xo,
  },
  yn = (e, t, n, s, r) => {
    if (Vr(n)) return void Ve(e, t, n, s != null ? String(s) : s);
    const o = Ko[n];
    o && o(e, t, s, n) ||
      (r || !(n in t)
        ? (n.startsWith(Ir) && Ws(n.slice(15)), Ve(e, t, n, s))
        : ie(e, t, n, s));
  },
  Qn = (e, t, n, s, r, o) => {
    const $ = {}, c = t.$element$;
    for (const i in s) {
      let l = s[i];
      if (i !== "ref") {
        if (is(i)) cs(t.li, i, l, e.$containerState$.$containerEl$);
        else {
          if (
            X(l) &&
            (l = ve(
              l,
              o ? [1, c, l, n.$element$, i] : [2, n.$element$, l, c, i],
            )), i === "class"
          ) { if (l = on(l, n), !l) continue; } else {i === "style" &&
              (l = $n(l));}
          $[i] = l, yn(e, c, i, l, r);
        }
      } else l !== void 0 && Rs(l, c);
    }
    return $;
  },
  Yo = (e, t, n) => {
    let s = t.$props$;
    if (s || (t.$props$ = s = St(nn(), e)), n === F) return;
    const r = z(s), o = we(s), $ = o[N] = n[N] ?? F;
    for (const c in n) {
      if (c !== "children" && c !== re && !$[c]) {
        const i = n[c];
        o[c] !== i && (o[c] = i, r.$notifySubs$(c));
      }
    }
  },
  We = (e, t, n, s) => {
    if (n.$clearSub$(e), le(e)) {
      if (s && e.hasAttribute("q:s")) return void t.$rmSlots$.push(e);
      const r = B(e);
      r && Co(r, n);
      const o = j(e) ? e.close : null;
      let $ = e.firstChild;
      for (; ($ = xn($)) && (We($, t, n, !0), $ = $.nextSibling, $ !== o););
    }
  },
  Wn = () => {
    document.__q_scroll_restore__ &&
      (document.__q_scroll_restore__(), document.__q_scroll_restore__ = void 0);
  },
  Zo = async (e) => {
    document.__q_view_transition__ &&
      (document.__q_view_transition__ = void 0, document.startViewTransition)
      ? await document.startViewTransition(() => {
        Bn(e), Wn();
      }).finished
      : (Bn(e), Wn());
  },
  Xe = (e, t) => {
    j(t) ? t.appendTo(e) : e.appendChild(t);
  },
  jo = (e, t) => {
    j(t) ? t.remove() : e.removeChild(t);
  },
  e$ = (e, t, n) => {
    j(t)
      ? t.insertBeforeTo(e, (n == null ? void 0 : n.nextSibling) ?? null)
      : e.insertBefore(t, (n == null ? void 0 : n.nextSibling) ?? null);
  },
  bt = (e, t, n) => {
    j(t) ? t.insertBeforeTo(e, ut(n)) : e.insertBefore(t, ut(n));
  },
  t$ = (e, t, n) => {
    const s = {};
    for (let r = t; r <= n; ++r) {
      const o = e[r].$key$;
      o != null && (s[o] = r);
    }
    return s;
  },
  Qs = (e, t, n) => {
    n.startsWith("on:") || Ve(e, t, n, ""), Ws(n);
  },
  Ws = (e) => {
    var t;
    {
      const n = Fo(e);
      try {
        ((t = globalThis).qwikevents || (t.qwikevents = [])).push(n);
      } catch {}
    }
  },
  Ve = (e, t, n, s) => {
    e.$operations$.push({ $operation$: n$, $args$: [t, n, s] });
  },
  n$ = (e, t, n) => {
    if (n == null || n === !1) e.removeAttribute(t);
    else {
      const s = n === !0 ? "" : String(n);
      Q(e, t, s);
    }
  },
  ie = (e, t, n, s) => {
    e.$operations$.push({ $operation$: Bs, $args$: [t, n, s] });
  },
  s$ = (e, t, n, s) => {
    e.$postOperations$.push({ $operation$: Bs, $args$: [t, n, s] });
  },
  Bs = (e, t, n) => {
    try {
      e[t] = n ?? "", n == null && Ee(e) && ce(e) && e.removeAttribute(t);
    } catch (s) {
      Se(pt(6), t, { node: e, value: n }, s);
    }
  },
  vn = (e, t, n) => n ? e.createElementNS(et, t) : e.createElement(t),
  Ne = (
    e,
    t,
    n,
    s,
  ) => (e.$operations$.push({ $operation$: bt, $args$: [t, n, s || null] }), n),
  r$ = (
    e,
    t,
    n,
    s,
  ) => (e.$operations$.push({ $operation$: e$, $args$: [t, n, s || null] }), n),
  Hs = (
    e,
    t,
    n,
  ) => (e.$operations$.push({ $operation$: Xe, $args$: [t, n] }), n),
  o$ = (e, t) => {
    e.$containerState$.$styleIds$.add(t.styleId),
      e.$postOperations$.push({
        $operation$: $$,
        $args$: [e.$containerState$, t],
      });
  },
  $$ = (e, t) => {
    const n = e.$containerEl$,
      s = Ye(n),
      r = s.documentElement === n,
      o = s.head,
      $ = s.createElement("style");
    Q($, Kt, t.styleId),
      Q($, "hidden", ""),
      $.textContent = t.content,
      r && o ? Xe(o, $) : bt(n, $, n.firstChild);
  },
  i$ = (e, t, n) => {
    e.$operations$.push({ $operation$: c$, $args$: [t, n] });
  },
  c$ = (e, t) => {
    bt(e, t, e.firstChild);
  },
  En = (e, t) => {
    le(t) && We(t, e, e.$containerState$.$subsManager$, !0),
      e.$operations$.push({ $operation$: l$, $args$: [t, e] });
  },
  l$ = (e) => {
    const t = e.parentElement;
    t && jo(t, e);
  },
  Us = (e, t) => {
    const n = vn(e, "q:template", !1);
    return Q(n, re, t), Q(n, "hidden", ""), Q(n, "aria-hidden", "true"), n;
  },
  Bn = (e) => {
    for (const t of e.$operations$) t.$operation$.apply(void 0, t.$args$);
    u$(e);
  },
  Dt = (e) => K(e, "q:key"),
  a$ = (e, t) => {
    t !== null && Q(e, "q:key", t);
  },
  u$ = (e) => {
    const t = e.$containerState$.$subsManager$;
    for (const n of e.$rmSlots$) {
      const s = Dt(n), r = Me(n, at);
      if (r.length > 0) {
        const o = n.getAttribute("q:sref"),
          $ = e.$roots$.find((c) => c.$id$ === o);
        if ($) {
          const c = $.$element$;
          if (c.isConnected) {
            if (Me(c, Lt).some((i) => K(i, re) === s)) We(n, e, t, !1);
            else {
              const i = Us(e.$doc$, s);
              for (const l of r) Xe(i, l);
              bt(c, i, c.firstChild);
            }
          } else We(n, e, t, !1);
        } else We(n, e, t, !1);
      }
    }
    for (const [n, s] of e.$addSlots$) {
      const r = Dt(n), o = Me(s, Lt).find(($) => $.getAttribute(re) === r);
      o && (Me(o, at).forEach(($) => {
        Xe(n, $);
      }),
        o.remove());
    }
  },
  Hn = () => {},
  f$ = (e, t) => {
    const n = e.createComment("qv "), s = e.createComment("/qv");
    return new Gs(n, s, t);
  },
  d$ = (e) => {
    if (!e) return {};
    const t = e.split(" ");
    return Object.fromEntries(t.map((n) => {
      const s = n.indexOf("=");
      return s >= 0 ? [n.slice(0, s), S$(n.slice(s + 1))] : [n, ""];
    }));
  },
  p$ = (e) => {
    const t = [];
    return Object.entries(e).forEach(([n, s]) => {
      t.push(s ? `${n}=${g$(s)}` : `${n}`);
    }),
      t.join(" ");
  },
  h$ = (e, t, n) =>
    e.ownerDocument.createTreeWalker(e, 128, {
      acceptNode(s) {
        const r = tt(s);
        return r && K(r, t) === n ? 1 : 2;
      },
    }),
  m$ = (e, t, n) => {
    const s = h$(e, t, n), r = [];
    let o = null;
    for (; o = s.nextNode();) r.push(tt(o));
    return r;
  },
  g$ = (e) => e.replace(/ /g, "+"),
  S$ = (e) => e.replace(/\+/g, " "),
  ze = ":virtual";
class Gs {
  constructor(t, n, s) {
    this.open = t,
      this.close = n,
      this.isSvg = s,
      this._qc_ = null,
      this.nodeType = 111,
      this.localName = ze,
      this.nodeName = ze;
    const r = this.ownerDocument = t.ownerDocument;
    this.$template$ = vn(r, "template", !1),
      this.$attributes$ = d$(t.data.slice(3)),
      t.data.startsWith("qv "),
      t.__virtual = this,
      n.__virtual = this;
  }
  insertBefore(t, n) {
    const s = this.parentElement;
    return s
      ? s.insertBefore(t, n || this.close)
      : this.$template$.insertBefore(t, n),
      t;
  }
  remove() {
    const t = this.parentElement;
    if (t) {
      const n = this.childNodes;
      this.$template$.childElementCount, t.removeChild(this.open);
      for (let s = 0; s < n.length; s++) this.$template$.appendChild(n[s]);
      t.removeChild(this.close);
    }
  }
  appendChild(t) {
    return this.insertBefore(t, null);
  }
  insertBeforeTo(t, n) {
    const s = this.childNodes;
    t.insertBefore(this.open, n);
    for (const r of s) t.insertBefore(r, n);
    t.insertBefore(this.close, n), this.$template$.childElementCount;
  }
  appendTo(t) {
    this.insertBeforeTo(t, null);
  }
  get namespaceURI() {
    var t;
    return ((t = this.parentElement) == null ? void 0 : t.namespaceURI) ?? "";
  }
  removeChild(t) {
    this.parentElement
      ? this.parentElement.removeChild(t)
      : this.$template$.removeChild(t);
  }
  getAttribute(t) {
    return this.$attributes$[t] ?? null;
  }
  hasAttribute(t) {
    return t in this.$attributes$;
  }
  setAttribute(t, n) {
    this.$attributes$[t] = n, this.open.data = Un(this.$attributes$);
  }
  removeAttribute(t) {
    delete this.$attributes$[t], this.open.data = Un(this.$attributes$);
  }
  matches(t) {
    return !1;
  }
  compareDocumentPosition(t) {
    return this.open.compareDocumentPosition(t);
  }
  closest(t) {
    const n = this.parentElement;
    return n ? n.closest(t) : null;
  }
  querySelectorAll(t) {
    const n = [];
    return Me(this, yr).forEach((s) => {
      le(s) &&
        (s.matches(t) && n.push(s),
          n.concat(Array.from(s.querySelectorAll(t))));
    }),
      n;
  }
  querySelector(t) {
    for (const n of this.childNodes) {
      if (ce(n)) {
        if (n.matches(t)) return n;
        const s = n.querySelector(t);
        if (s !== null) return s;
      }
    }
    return null;
  }
  get innerHTML() {
    return "";
  }
  set innerHTML(t) {
    const n = this.parentElement;
    n
      ? (this.childNodes.forEach((s) => this.removeChild(s)),
        this.$template$.innerHTML = t,
        n.insertBefore(this.$template$.content, this.close))
      : this.$template$.innerHTML = t;
  }
  get firstChild() {
    if (this.parentElement) {
      const t = this.open.nextSibling;
      return t === this.close ? null : t;
    }
    return this.$template$.firstChild;
  }
  get nextSibling() {
    return this.close.nextSibling;
  }
  get previousSibling() {
    return this.open.previousSibling;
  }
  get childNodes() {
    if (!this.parentElement) return Array.from(this.$template$.childNodes);
    const t = [];
    let n = this.open;
    for (; (n = n.nextSibling) && n !== this.close;) t.push(n);
    return t;
  }
  get isConnected() {
    return this.open.isConnected;
  }
  get parentElement() {
    return this.open.parentElement;
  }
}
const Un = (e) => `qv ${p$(e)}`,
  xn = (e) => {
    if (e == null) return null;
    if (Ke(e)) {
      const t = tt(e);
      if (t) return t;
    }
    return e;
  },
  y$ = (e) => {
    let t = e, n = 1;
    for (; t = t.nextSibling;) {
      if (Ke(t)) {
        const s = t.__virtual;
        if (s) t = s;
        else if (t.data.startsWith("qv ")) n++;
        else if (t.data === "/qv" && (n--, n === 0)) return t;
      }
    }
  },
  tt = (e) => {
    var n;
    const t = e.__virtual;
    if (t) return t;
    if (e.data.startsWith("qv ")) {
      const s = y$(e);
      return new Gs(
        e,
        s,
        ((n = e.parentElement) == null ? void 0 : n.namespaceURI) === et,
      );
    }
    return null;
  },
  ut = (e) => e == null ? null : j(e) ? e.open : e,
  sc = async (e) => {
    const t = Ps(null, null), n = Js(t);
    let s;
    for (T(e, n, !1); (s = n.$promises$).length > 0;) {
      n.$promises$ = [];
      const l = await Promise.allSettled(s);
      for (const a of l) a.status === "rejected" && console.error(a.reason);
    }
    const r = Array.from(n.$objSet$.keys());
    let o = 0;
    const $ = new Map();
    for (const l of r) $.set(l, $e(o)), o++;
    if (n.$noSerialize$.length > 0) {
      const l = $.get(void 0);
      for (const a of n.$noSerialize$) $.set(a, l);
    }
    const c = (l) => {
        let a = "";
        if (V(l)) {
          const h = Xs(l);
          if (!h) throw M(27, l);
          l = h.value, a += h.resolved ? "~" : "_";
        }
        if (ae(l)) {
          const h = we(l);
          h && (a += "!", l = h);
        }
        const f = $.get(l);
        if (f === void 0) throw M(27, l);
        return f + a;
      },
      i = Ks(r, c, null, n, t);
    return JSON.stringify({ _entry: c(e), _objs: i });
  },
  v$ = async (e) => {
    const t = Ye(e), n = t.documentElement, s = ts(e) ? n : e;
    if (K(s, "q:container") === "paused") throw M(21);
    const r = s === t.documentElement ? t.body : s, o = be(s), $ = x$(s, C$);
    Q(s, "q:container", "paused");
    for (const f of $) {
      const h = f.$element$, p = f.li;
      if (f.$scopeIds$) {
        const m = Dr(f.$scopeIds$);
        m && h.setAttribute("q:sstyle", m);
      }
      if (f.$id$ && h.setAttribute("q:id", f.$id$), ce(h) && p.length > 0) {
        const m = Cr(p);
        for (const S of m) h.setAttribute(S[0], z$(S[1], o, f));
      }
    }
    const c = await E$($, o, (f) => Ee(f) && Ut(f) ? P$(f, o) : null),
      i = t.createElement("script");
    Q(i, "type", "qwik/json"),
      i.textContent = T$(JSON.stringify(c.state, void 0, void 0)),
      r.appendChild(i);
    const l = Array.from(o.$events$, (f) => JSON.stringify(f)),
      a = t.createElement("script");
    return a.textContent = `(window.qwikevents||=[]).push(${l.join(", ")})`,
      r.appendChild(a),
      c;
  },
  E$ = async (e, t, n, s) => {
    var v;
    const r = Js(t);
    let o = !1;
    for (const d of e) {
      if (d.$tasks$) {
        for (const x of d.$tasks$) {
          ws(x) && r.$resources$.push(x.$state$), Ts(x);
        }
      }
    }
    for (const d of e) {
      const x = d.$element$, b = d.li;
      for (const _ of b) {
        if (ce(x)) {
          const w = _[1], C = w.$captureRef$;
          if (C) { for (const k of C) T(k, r, !0); }
          r.$qrls$.push(w), o = !0;
        }
      }
    }
    if (!o) {
      return {
        state: { refs: {}, ctx: {}, objs: [], subs: [] },
        objs: [],
        funcs: [],
        qrls: [],
        resources: r.$resources$,
        mode: "static",
      };
    }
    let $;
    for (; ($ = r.$promises$).length > 0;) {
      r.$promises$ = [], await Promise.all($);
    }
    const c = r.$elements$.length > 0;
    if (c) {
      for (const d of r.$deferElements$) bn(d, r, d.$element$);
      for (const d of e) b$(d, r);
    }
    for (; ($ = r.$promises$).length > 0;) {
      r.$promises$ = [], await Promise.all($);
    }
    const i = new Map(),
      l = Array.from(r.$objSet$.keys()),
      a = new Map(),
      f = (d) => {
        let x = "";
        if (V(d)) {
          const w = Xs(d);
          if (!w) return null;
          d = w.value, x += w.resolved ? "~" : "_";
        }
        if (ae(d)) {
          const w = we(d);
          if (w) x += "!", d = w;
          else if (le(d)) {
            const C = ((k) => {
              let H = i.get(k);
              return H === void 0 &&
                (H = N$(k), H || console.warn("Missing ID", k), i.set(k, H)),
                H;
            })(d);
            return C ? "#" + C + x : null;
          }
        }
        const b = a.get(d);
        if (b) return b + x;
        const _ = s == null ? void 0 : s.get(d);
        return _ ? "*" + _ : n ? n(d) : null;
      },
      h = (d) => {
        const x = f(d);
        if (x === null) {
          if (Tn(d)) {
            const b = $e(a.size);
            return a.set(d, b), b;
          }
          throw M(27, d);
        }
        return x;
      },
      p = new Map();
    for (const d of l) {
      const x = (v = M$(d, t)) == null ? void 0 : v.$subs$;
      if (!x) continue;
      const b = or(d) ?? 0, _ = [];
      1 & b && _.push(b);
      for (const w of x) {
        const C = w[1];
        w[0] === 0 && Ee(C) && j(C) && !r.$elements$.includes(B(C)) ||
          _.push(w);
      }
      _.length > 0 && p.set(d, _);
    }
    l.sort((d, x) => (p.has(d) ? 0 : 1) - (p.has(x) ? 0 : 1));
    let m = 0;
    for (const d of l) a.set(d, $e(m)), m++;
    if (r.$noSerialize$.length > 0) {
      const d = a.get(void 0);
      for (const x of r.$noSerialize$) a.set(x, d);
    }
    const S = [];
    for (const d of l) {
      const x = p.get(d);
      if (x == null) break;
      S.push(
        x.map((b) => typeof b == "number" ? `_${b}` : hi(b, f)).filter(ss),
      );
    }
    S.length, p.size;
    const y = Ks(l, h, f, r, t), u = {}, g = {};
    for (const d of e) {
      const x = d.$element$,
        b = d.$id$,
        _ = d.$refMap$,
        w = d.$props$,
        C = d.$contexts$,
        k = d.$tasks$,
        H = d.$componentQrl$,
        ue = d.$seq$,
        ee = {},
        _e = j(x) && r.$elements$.includes(d);
      if (_.length > 0) {
        const L = ge(_, h, " ");
        L && (g[b] = L);
      } else if (c) {
        let L = !1;
        if (_e) {
          const P = f(w);
          ee.h = h(H) + (P ? " " + P : ""), L = !0;
        } else {
          const P = f(w);
          P && (ee.h = " " + P, L = !0);
        }
        if (k && k.length > 0) {
          const P = ge(k, f, " ");
          P && (ee.w = P, L = !0);
        }
        if (_e && ue && ue.length > 0) {
          const P = ge(ue, h, " ");
          ee.s = P, L = !0;
        }
        if (C) {
          const P = [];
          C.forEach((gr, Sr) => {
            const Mn = f(gr);
            Mn && P.push(`${Sr}=${Mn}`);
          });
          const De = P.join(" ");
          De && (ee.c = De, L = !0);
        }
        L && (u[b] = ee);
      }
    }
    return {
      state: { refs: g, ctx: u, objs: y, subs: S },
      objs: l,
      funcs: r.$inlinedFunctions$,
      resources: r.$resources$,
      qrls: r.$qrls$,
      mode: c ? "render" : "listeners",
    };
  },
  ge = (e, t, n) => {
    let s = "";
    for (const r of e) {
      const o = t(r);
      o !== null && (s !== "" && (s += n), s += o);
    }
    return s;
  },
  x$ = (e, t) => {
    const n = [], s = t(e);
    s !== void 0 && n.push(s);
    const r = e.ownerDocument.createTreeWalker(e, 1 | qs, {
      acceptNode(o) {
        if (I$(o)) return 2;
        const $ = t(o);
        return $ !== void 0 && n.push($), 3;
      },
    });
    for (; r.nextNode(););
    return n;
  },
  b$ = (e, t) => {
    var r;
    const n = e.$realParentCtx$ || e.$parentCtx$, s = e.$props$;
    if (n && s && !Vs(s) && t.$elements$.includes(n)) {
      const o = (r = z(s)) == null ? void 0 : r.$subs$, $ = e.$element$;
      if (o) {
        for (const [c, i] of o) {
          c === 0
            ? (i !== $ && Oe(z(s), t, !1), Ee(i) ? _$(i, t) : T(i, t, !0))
            : (T(s, t, !1), Oe(z(s), t, !1));
        }
      }
    }
  },
  Js = (e) => {
    const t = [];
    return e.$inlineFns$.forEach((n, s) => {
      for (; t.length <= n;) t.push("");
      t[n] = s;
    }),
      {
        $containerState$: e,
        $seen$: new Set(),
        $objSet$: new Set(),
        $prefetch$: 0,
        $noSerialize$: [],
        $inlinedFunctions$: t,
        $resources$: [],
        $elements$: [],
        $qrls$: [],
        $deferElements$: [],
        $promises$: [],
      };
  },
  w$ = (e, t) => {
    const n = B(e);
    t.$elements$.includes(n) ||
      (t.$elements$.push(n),
        n.$flags$ & As
          ? (t.$prefetch$++, bn(n, t, !0), t.$prefetch$--)
          : t.$deferElements$.push(n));
  },
  _$ = (e, t) => {
    const n = B(e);
    if (n) {
      if (t.$elements$.includes(n)) return;
      t.$elements$.push(n), bn(n, t, e);
    }
  },
  bn = (e, t, n) => {
    if (
      e.$props$ && !Vs(e.$props$) &&
      (T(e.$props$, t, n), Oe(z(e.$props$), t, n)),
        e.$componentQrl$ && T(e.$componentQrl$, t, n),
        e.$seq$
    ) { for (const s of e.$seq$) T(s, t, n); }
    if (e.$tasks$) {
      const s = t.$containerState$.$subsManager$.$groupToManagers$;
      for (const r of e.$tasks$) s.has(r) && T(r, t, n);
    }
    if (n === !0 && (Gn(e, t), e.$dynamicSlots$)) {
      for (const s of e.$dynamicSlots$) {
        Gn(s, t);
      }
    }
  },
  Gn = (e, t) => {
    for (; e;) {
      if (e.$contexts$) { for (const n of e.$contexts$.values()) T(n, t, !0); }
      e = e.$parentCtx$;
    }
  },
  T$ = (e) => e.replace(/<(\/?script)/gi, "\\x3C$1"),
  Oe = (e, t, n) => {
    if (t.$seen$.has(e)) return;
    t.$seen$.add(e);
    const s = e.$subs$;
    for (const r of s) {
      if (r[0] > 0 && T(r[2], t, n), n === !0) {
        const o = r[1];
        Ee(o) && j(o) ? r[0] === 0 && w$(o, t) : T(o, t, !0);
      }
    }
  },
  Ft = Symbol(),
  A$ = (e) =>
    e.then(
      (t) => (e[Ft] = { resolved: !0, value: t }, t),
      (t) => (e[Ft] = { resolved: !1, value: t }, t),
    ),
  Xs = (e) => e[Ft],
  T = (e, t, n) => {
    if (e != null) {
      const s = typeof e;
      switch (s) {
        case "function":
        case "object": {
          if (t.$seen$.has(e)) return;
          if (t.$seen$.add(e), nr(e)) {
            return t.$objSet$.add(void 0), void t.$noSerialize$.push(e);
          }
          const r = e, o = we(e);
          if (o) {
            const $ = !(2 & or(e = o));
            if (n && $ && Oe(z(r), t, n), sr(r)) return void t.$objSet$.add(e);
          }
          if (ai(e, t, n)) return void t.$objSet$.add(e);
          if (V(e)) {
            return void t.$promises$.push(
              A$(e).then(($) => {
                T($, t, n);
              }),
            );
          }
          if (s === "object") {
            if (Ee(e)) return;
            if (R(e)) { for (let $ = 0; $ < e.length; $++) T(r[$], t, n); }
            else if (mt(e)) { for (const $ in e) T(r[$], t, n); }
          }
          break;
        }
      }
    }
    t.$objSet$.add(e);
  },
  I$ = (e) => ce(e) && e.hasAttribute("q:container"),
  C$ = (e) => {
    const t = xn(e);
    if (le(t)) {
      const n = B(t);
      if (n && n.$id$) return n;
    }
  },
  M$ = (e, t) => {
    if (!ae(e)) return;
    if (e instanceof Je) return z(e);
    const n = t.$proxyMap$.get(e);
    return n ? z(n) : void 0;
  },
  N$ = (e) => {
    const t = B(e);
    return t ? t.$id$ : null;
  },
  P$ = (e, t) => {
    const n = e.previousSibling;
    if (n && Ke(n) && n.data.startsWith("t=")) return "#" + n.data.slice(2);
    const s = e.ownerDocument,
      r = $e(t.$elementIndex$++),
      o = s.createComment(`t=${r}`),
      $ = s.createComment(""),
      c = e.parentElement;
    return c.insertBefore(o, e), c.insertBefore($, e.nextSibling), "#" + r;
  },
  Vs = (e) => Object.keys(e).length === 0;
function Ks(e, t, n, s, r) {
  return e.map((o) => {
    if (o === null) return null;
    const $ = typeof o;
    switch ($) {
      case "undefined":
        return _t;
      case "number":
        if (!Number.isFinite(o)) break;
        return o;
      case "string":
        if (o.charCodeAt(0) < 32) break;
        return o;
      case "boolean":
        return o;
    }
    const c = ui(o, t, s, r);
    if (c !== void 0) return c;
    if ($ === "object") {
      if (R(o)) return o.map(t);
      if (mt(o)) {
        const i = {};
        for (const l in o) {
          if (n) {
            const a = n(o[l]);
            a !== null && (i[l] = a);
          } else i[l] = t(o[l]);
        }
        return i;
      }
    }
    throw M(3, o);
  });
}
const R$ = /\(\s*(['"])([^\1]+)\1\s*\)/,
  q$ = /Promise\s*\.\s*resolve/,
  k$ = /[\\/(]([\w\d.\-_]+\.(js|ts)x?):/,
  Jn = new Set(),
  rc = (e, t, n = ne, s = 0) => {
    let r = null, o = null;
    if (U(e)) {
      o = e;
      {
        let $;
        const c = String(e);
        if (($ = c.match(R$)) && $[2]) r = $[2];
        else {
          if (!($ = c.match(q$))) throw M(11, c);
          {
            const i = "QWIK-SELF",
              l = new Error(i).stack.split(`
`),
              a = l.findIndex((f) => f.includes(i));
            $ = l[a + 2 + s].match(k$), r = $ ? $[1] : "main";
          }
        }
      }
    } else {
      if (!Le(e)) throw M(12, e);
      r = e;
    }
    return Jn.has(t) ||
      (Jn.add(t), cr("qprefetch", { symbols: [ir(t)], bundles: r && [r] })),
      nt(r, t, null, o, null, n, null);
  },
  oc = (e, t = ne) => nt(null, e, null, null, null, t, null),
  wn = (e, t = {}) => {
    var l, a;
    let n = e.$symbol$, s = e.$chunk$;
    const r = e.$refSymbol$ ?? n, o = Xt();
    if (o) {
      const f = o.chunkForSymbol(r, s, (l = e.dev) == null ? void 0 : l.file);
      f ? (s = f[1], e.$refSymbol$ || (n = f[0])) : console.error(
        "serializeQRL: Cannot resolve symbol",
        n,
        "in",
        s,
        (a = e.dev) == null ? void 0 : a.file,
      );
    }
    if (s == null) throw M(31, e.$symbol$);
    if (s.startsWith("./") && (s = s.slice(2)), vi(e)) {
      if (t.$containerState$) {
        const f = t.$containerState$, h = e.resolved.toString();
        let p = f.$inlineFns$.get(h);
        p === void 0 && (p = f.$inlineFns$.size, f.$inlineFns$.set(h, p)),
          n = String(p);
      } else vr("Sync QRL without containerState");
    }
    let $ = `${s}#${n}`;
    const c = e.$capture$, i = e.$captureRef$;
    return i && i.length
      ? t.$getObjId$
        ? $ += `[${ge(i, t.$getObjId$, " ")}]`
        : t.$addRefMap$ && ($ += `[${ge(i, t.$addRefMap$, " ")}]`)
      : c && c.length > 0 && ($ += `[${c.join(" ")}]`),
      $;
  },
  z$ = (e, t, n) => {
    n.$element$;
    const s = { $containerState$: t, $addRefMap$: (r) => O$(n.$refMap$, r) };
    return ge(
      e,
      (r) => wn(r, s),
      `
`,
    );
  },
  wt = (e, t) => {
    const n = e.length,
      s = Xn(e, 0, "#"),
      r = Xn(e, s, "["),
      o = Math.min(s, r),
      $ = e.substring(0, o),
      c = s == n ? s : s + 1,
      i = c == r ? "default" : e.substring(c, r),
      l = r === n ? ne : e.substring(r + 1, n - 1).split(" "),
      a = nt($, i, null, null, l, null, null);
    return t && a.$setContainer$(t), a;
  },
  Xn = (e, t, n) => {
    const s = e.length, r = e.indexOf(n, t == s ? 0 : t);
    return r == -1 ? s : r;
  },
  O$ = (e, t) => {
    const n = e.indexOf(t);
    return n === -1 ? (e.push(t), String(e.length - 1)) : String(n);
  },
  Ys = (e, t) => (e.$capture$,
    e.$captureRef$ = e.$capture$.map((n) => {
      const s = parseInt(n, 10), r = t.$refMap$[s];
      return t.$refMap$.length > s, r;
    })),
  L$ = (e) => ({
    __brand: "resource",
    value: void 0,
    loading: !ht(),
    _resolved: void 0,
    _error: void 0,
    _state: "pending",
    _timeout: (e == null ? void 0 : e.timeout) ?? -1,
    _cache: 0,
  }),
  D$ = (e) => ae(e) && e.__brand === "resource",
  F$ = (e, t) => {
    const n = e._state;
    return n === "resolved"
      ? `0 ${t(e._resolved)}`
      : n === "pending"
      ? "1"
      : `2 ${t(e._error)}`;
  },
  Q$ = (e) => {
    const [t, n] = e.split(" "), s = L$(void 0);
    return s.value = Promise.resolve(),
      t === "0"
        ? (s._state = "resolved", s._resolved = n, s.loading = !1)
        : t === "1"
        ? (s._state = "pending",
          s.value = new Promise(() => {}),
          s.loading = !0)
        : t === "2" && (s._state = "rejected", s._error = n, s.loading = !1),
      s;
  },
  Qt = (e) => ln(Be, { [rs]: "" }, 0, e.name ?? ""),
  _t = "";
function I(e) {
  return {
    $prefixCode$: e.$prefix$.charCodeAt(0),
    $prefixChar$: e.$prefix$,
    $test$: e.$test$,
    $serialize$: e.$serialize$,
    $prepare$: e.$prepare$,
    $fill$: e.$fill$,
    $collect$: e.$collect$,
    $subs$: e.$subs$,
  };
}
const W$ = I({
    $prefix$: "",
    $test$: (e) => Tn(e),
    $collect$: (e, t, n) => {
      if (e.$captureRef$) { for (const s of e.$captureRef$) T(s, t, n); }
      t.$prefetch$ === 0 && t.$qrls$.push(e);
    },
    $serialize$: (e, t) => wn(e, { $getObjId$: t }),
    $prepare$: (e, t) => wt(e, t.$containerEl$),
    $fill$: (e, t) => {
      e.$capture$ && e.$capture$.length > 0 &&
        (e.$captureRef$ = e.$capture$.map(t), e.$capture$ = null);
    },
  }),
  B$ = I({
    $prefix$: "",
    $test$: (e) => pn(e),
    $collect$: (e, t, n) => {
      T(e.$qrl$, t, n),
        e.$state$ &&
        (T(e.$state$, t, n),
          n === !0 && e.$state$ instanceof Je && Oe(e.$state$[Z], t, !0));
    },
    $serialize$: (e, t) => wo(e, t),
    $prepare$: (e) => _o(e),
    $fill$: (e, t) => {
      e.$el$ = t(e.$el$),
        e.$qrl$ = t(e.$qrl$),
        e.$state$ && (e.$state$ = t(e.$state$));
    },
  }),
  H$ = I({
    $prefix$: "",
    $test$: (e) => D$(e),
    $collect$: (e, t, n) => {
      T(e.value, t, n), T(e._resolved, t, n);
    },
    $serialize$: (e, t) => F$(e, t),
    $prepare$: (e) => Q$(e),
    $fill$: (e, t) => {
      if (e._state === "resolved") {
        e._resolved = t(e._resolved), e.value = Promise.resolve(e._resolved);
      } else if (e._state === "rejected") {
        const n = Promise.reject(e._error);
        n.catch(() => null), e._error = t(e._error), e.value = n;
      }
    },
  }),
  U$ = I({
    $prefix$: "",
    $test$: (e) => e instanceof URL,
    $serialize$: (e) => e.href,
    $prepare$: (e) => new URL(e),
  }),
  G$ = I({
    $prefix$: "",
    $test$: (e) => e instanceof Date,
    $serialize$: (e) => e.toISOString(),
    $prepare$: (e) => new Date(e),
  }),
  J$ = I({
    $prefix$: "\x07",
    $test$: (e) => e instanceof RegExp,
    $serialize$: (e) => `${e.flags} ${e.source}`,
    $prepare$: (e) => {
      const t = e.indexOf(" "), n = e.slice(t + 1), s = e.slice(0, t);
      return new RegExp(n, s);
    },
  }),
  X$ = I({
    $prefix$: "",
    $test$: (e) => e instanceof Error,
    $serialize$: (e) => e.message,
    $prepare$: (e) => {
      const t = new Error(e);
      return t.stack = void 0, t;
    },
  }),
  V$ = I({
    $prefix$: "",
    $test$: (e) => !!e && typeof e == "object" && ts(e),
    $prepare$: (e, t, n) => n,
  }),
  ft = Symbol("serializable-data"),
  K$ = I({
    $prefix$: "",
    $test$: (e) => An(e),
    $serialize$: (e, t) => {
      const [n] = e[ft];
      return wn(n, { $getObjId$: t });
    },
    $prepare$: (e, t) => {
      const n = wt(e, t.$containerEl$);
      return bi(n);
    },
    $fill$: (e, t) => {
      var s;
      const [n] = e[ft];
      (s = n.$capture$) != null && s.length &&
        (n.$captureRef$ = n.$capture$.map(t), n.$capture$ = null);
    },
  }),
  Y$ = I({
    $prefix$: "",
    $test$: (e) => e instanceof zt,
    $collect$: (e, t, n) => {
      if (e.$args$) { for (const s of e.$args$) T(s, t, n); }
    },
    $serialize$: (e, t, n) => {
      const s = Yr(e);
      let r = n.$inlinedFunctions$.indexOf(s);
      return r < 0 &&
        (r = n.$inlinedFunctions$.length, n.$inlinedFunctions$.push(s)),
        ge(e.$args$, t, " ") + " @" + $e(r);
    },
    $prepare$: (e) => {
      const t = e.split(" "), n = t.slice(0, -1), s = t[t.length - 1];
      return new zt(s, n, s);
    },
    $fill$: (e, t) => {
      e.$func$, e.$func$ = t(e.$func$), e.$args$ = e.$args$.map(t);
    },
  }),
  Z$ = I({
    $prefix$: "",
    $test$: (e) => e instanceof Je,
    $collect$: (
      e,
      t,
      n,
    ) => (T(e.untrackedValue, t, n),
      n === !0 && !(e[Ge] & Oo) && Oe(e[Z], t, !0),
      e),
    $serialize$: (e, t) => t(e.untrackedValue),
    $prepare$: (e, t) => {
      var n;
      return new Je(
        e,
        (n = t == null ? void 0 : t.$subsManager$) == null
          ? void 0
          : n.$createManager$(),
        0,
      );
    },
    $subs$: (e, t) => {
      e[Z].$addSubs$(t);
    },
    $fill$: (e, t) => {
      e.untrackedValue = t(e.untrackedValue);
    },
  }),
  j$ = I({
    $prefix$: "",
    $test$: (e) => e instanceof Ot,
    $collect$(e, t, n) {
      if (T(e.ref, t, n), sr(e.ref)) {
        const s = z(e.ref);
        di(t.$containerState$.$subsManager$, s, n) && T(e.ref[e.prop], t, n);
      }
      return e;
    },
    $serialize$: (e, t) => `${t(e.ref)} ${e.prop}`,
    $prepare$: (e) => {
      const [t, n] = e.split(" ");
      return new Ot(t, n);
    },
    $fill$: (e, t) => {
      e.ref = t(e.ref);
    },
  }),
  ei = I({
    $prefix$: "",
    $test$: (e) => typeof e == "number",
    $serialize$: (e) => String(e),
    $prepare$: (e) => Number(e),
  }),
  ti = I({
    $prefix$: "",
    $test$: (e) => e instanceof URLSearchParams,
    $serialize$: (e) => e.toString(),
    $prepare$: (e) => new URLSearchParams(e),
  }),
  ni = I({
    $prefix$: "",
    $test$: (e) => typeof FormData < "u" && e instanceof globalThis.FormData,
    $serialize$: (e) => {
      const t = [];
      return e.forEach((n, s) => {
        t.push(typeof n == "string" ? [s, n] : [s, n.name]);
      }),
        JSON.stringify(t);
    },
    $prepare$: (e) => {
      const t = JSON.parse(e), n = new FormData();
      for (const [s, r] of t) n.append(s, r);
      return n;
    },
  }),
  si = I({
    $prefix$: "",
    $test$: (e) => vt(e),
    $collect$: (e, t, n) => {
      T(e.children, t, n),
        T(e.props, t, n),
        T(e.immutableProps, t, n),
        T(e.key, t, n);
      let s = e.type;
      s === Qt ? s = ":slot" : s === Rt && (s = ":fragment"), T(s, t, n);
    },
    $serialize$: (e, t) => {
      let n = e.type;
      return n === Qt ? n = ":slot" : n === Rt && (n = ":fragment"),
        `${t(n)} ${t(e.props)} ${t(e.immutableProps)} ${t(e.key)} ${
          t(e.children)
        } ${e.flags}`;
    },
    $prepare$: (e) => {
      const [t, n, s, r, o, $] = e.split(" ");
      return new Ze(t, n, s, o, parseInt($, 10), r);
    },
    $fill$: (e, t) => {
      e.type = pi(t(e.type)),
        e.props = t(e.props),
        e.immutableProps = t(e.immutableProps),
        e.key = t(e.key),
        e.children = t(e.children);
    },
  }),
  ri = I({
    $prefix$: "",
    $test$: (e) => typeof e == "bigint",
    $serialize$: (e) => e.toString(),
    $prepare$: (e) => BigInt(e),
  }),
  oi = I({
    $prefix$: "",
    $test$: (e) => e instanceof Uint8Array,
    $serialize$: (e) => {
      let t = "";
      for (const n of e) t += String.fromCharCode(n);
      return btoa(t).replace(/=+$/, "");
    },
    $prepare$: (e) => {
      const t = atob(e), n = new Uint8Array(t.length);
      let s = 0;
      for (const r of t) n[s++] = r.charCodeAt(0);
      return n;
    },
    $fill$: void 0,
  }),
  Re = Symbol(),
  $i = I({
    $prefix$: "",
    $test$: (e) => e instanceof Set,
    $collect$: (e, t, n) => {
      e.forEach((s) => T(s, t, n));
    },
    $serialize$: (e, t) => Array.from(e).map(t).join(" "),
    $prepare$: (e) => {
      const t = new Set();
      return t[Re] = e, t;
    },
    $fill$: (e, t) => {
      const n = e[Re];
      e[Re] = void 0;
      const s = n.length === 0 ? [] : n.split(" ");
      for (const r of s) e.add(t(r));
    },
  }),
  ii = I({
    $prefix$: "",
    $test$: (e) => e instanceof Map,
    $collect$: (e, t, n) => {
      e.forEach((s, r) => {
        T(s, t, n), T(r, t, n);
      });
    },
    $serialize$: (e, t) => {
      const n = [];
      return e.forEach((s, r) => {
        n.push(t(r) + " " + t(s));
      }),
        n.join(" ");
    },
    $prepare$: (e) => {
      const t = new Map();
      return t[Re] = e, t;
    },
    $fill$: (e, t) => {
      const n = e[Re];
      e[Re] = void 0;
      const s = n.length === 0 ? [] : n.split(" ");
      s.length % 2;
      for (let r = 0; r < s.length; r += 2) e.set(t(s[r]), t(s[r + 1]));
    },
  }),
  ci = I({
    $prefix$: "\x1B",
    $test$: (e) => !!Zs(e) || e === _t,
    $serialize$: (e) => e,
    $prepare$: (e) => e,
  }),
  _n = [
    W$,
    B$,
    H$,
    U$,
    G$,
    J$,
    X$,
    V$,
    K$,
    Y$,
    Z$,
    j$,
    ei,
    ti,
    ni,
    si,
    ri,
    $i,
    ii,
    ci,
    oi,
  ],
  Vn = (() => {
    const e = [];
    return _n.forEach((t) => {
      const n = t.$prefixCode$;
      for (; e.length < n;) e.push(void 0);
      e.push(t);
    }),
      e;
  })();
function Zs(e) {
  if (typeof e == "string") {
    const t = e.charCodeAt(0);
    if (t < Vn.length) return Vn[t];
  }
}
const li = _n.filter((e) => e.$collect$),
  ai = (e, t, n) => {
    for (const s of li) if (s.$test$(e)) return s.$collect$(e, t, n), !0;
    return !1;
  },
  ui = (e, t, n, s) => {
    for (const r of _n) {
      if (r.$test$(e)) {
        let o = r.$prefixChar$;
        return r.$serialize$ && (o += r.$serialize$(e, t, n, s)), o;
      }
    }
    if (typeof e == "string") return e;
  },
  js = (e, t) => {
    const n = new Map(), s = new Map();
    return {
      prepare(r) {
        const o = Zs(r);
        if (o) {
          const $ = o.$prepare$(r.slice(1), e, t);
          return o.$fill$ && n.set($, o), o.$subs$ && s.set($, o), $;
        }
        return r;
      },
      subs(r, o) {
        const $ = s.get(r);
        return !!$ && ($.$subs$(r, o, e), !0);
      },
      fill(r, o) {
        const $ = n.get(r);
        return !!$ && ($.$fill$(r, o, e), !0);
      },
    };
  },
  fi = {
    "!": (e, t) => t.$proxyMap$.get(e) ?? tn(e, t),
    "~": (e) => Promise.resolve(e),
    _: (e) => Promise.reject(e),
  },
  di = (e, t, n) => {
    if (typeof n == "boolean") return n;
    const s = e.$groupToManagers$.get(n);
    return !!(s && s.length > 0) && (s.length !== 1 || s[0] !== t);
  },
  pi = (e) => e === ":slot" ? Qt : e === ":fragment" ? Rt : e,
  er = new WeakSet(),
  tr = new WeakSet(),
  nr = (e) => er.has(e),
  sr = (e) => tr.has(e),
  rr = (e) => (e != null && er.add(e), e),
  $c = (e) => (tr.add(e), e),
  Tt = (e) => ae(e) ? we(e) ?? e : e,
  we = (e) => e[Ct],
  z = (e) => e[Z],
  or = (e) => e[Ce],
  hi = (e, t) => {
    const n = e[0], s = typeof e[1] == "string" ? e[1] : t(e[1]);
    if (!s) return;
    let r = n + " " + s, o;
    if (n === 0) o = e[2];
    else {
      const $ = t(e[2]);
      if (!$) return;
      n <= 2 ? (o = e[5], r += ` ${$} ${Kn(t(e[3]))} ${e[4]}`) : n <= 4 &&
        (o = e[4],
          r += ` ${$} ${typeof e[3] == "string" ? e[3] : Kn(t(e[3]))}`);
    }
    return o && (r += ` ${encodeURI(o)}`), r;
  },
  mi = (e, t) => {
    const n = e.split(" "), s = parseInt(n[0], 10);
    n.length >= 2;
    const r = t(n[1]);
    if (!r || pn(r) && !r.$el$) return;
    const o = [s, r];
    return s === 0
      ? (n.length <= 3, o.push(It(n[2])))
      : s <= 2
      ? (n.length === 5 || n.length, o.push(t(n[2]), t(n[3]), n[4], It(n[5])))
      : s <= 4 &&
        (n.length === 4 || n.length, o.push(t(n[2]), t(n[3]), It(n[4]))),
      o;
  },
  It = (e) => {
    if (e !== void 0) return decodeURI(e);
  },
  gi = (e) => {
    const t = new Map();
    return {
      $groupToManagers$: t,
      $createManager$: (s) => new Si(t, e, s),
      $clearSub$: (s) => {
        const r = t.get(s);
        if (r) {
          for (const o of r) o.$unsubGroup$(s);
          t.delete(s), r.length = 0;
        }
      },
      $clearSignal$: (s) => {
        const r = t.get(s[1]);
        if (r) { for (const o of r) o.$unsubEntry$(s); }
      },
    };
  };
class Si {
  constructor(t, n, s) {
    this.$groupToManagers$ = t,
      this.$containerState$ = n,
      this.$subs$ = [],
      s && this.$addSubs$(s);
  }
  $addSubs$(t) {
    this.$subs$.push(...t);
    for (const n of this.$subs$) this.$addToGroup$(n[1], this);
  }
  $addToGroup$(t, n) {
    let s = this.$groupToManagers$.get(t);
    s || this.$groupToManagers$.set(t, s = []), s.includes(n) || s.push(n);
  }
  $unsubGroup$(t) {
    const n = this.$subs$;
    for (let s = 0; s < n.length; s++) n[s][1] === t && (n.splice(s, 1), s--);
  }
  $unsubEntry$(t) {
    const [n, s, r, o] = t, $ = this.$subs$;
    if (n === 1 || n === 2) {
      const c = t[4];
      for (let i = 0; i < $.length; i++) {
        const l = $[i];
        l[0] === n && l[1] === s && l[2] === r && l[3] === o && l[4] === c &&
          ($.splice(i, 1), i--);
      }
    } else if (n === 3 || n === 4) {
      for (let c = 0; c < $.length; c++) {
        const i = $[c];
        i[0] === n && i[1] === s && i[2] === r && i[3] === o &&
          ($.splice(c, 1), c--);
      }
    }
  }
  $addSub$(t, n) {
    const s = this.$subs$, r = t[1];
    t[0] === 0 && s.some(([o, $, c]) => o === 0 && $ === r && c === n) ||
      (s.push($r = [...t, n]), this.$addToGroup$(r, this));
  }
  $notifySubs$(t) {
    const n = this.$subs$;
    for (const s of n) {
      const r = s[s.length - 1];
      t && r && r !== t || lo(s, this.$containerState$);
    }
  }
}
let $r;
function yi() {
  return $r;
}
const Kn = (e) => {
    if (e == null) throw Se("must be non null", e);
    return e;
  },
  Tn = (e) => typeof e == "function" && typeof e.getSymbol == "function",
  vi = (e) => Tn(e) && e.$symbol$ == "<sync>",
  nt = (e, t, n, s, r, o, $) => {
    let c;
    const i = async function (...u) {
        return await p.call(this, W())(...u);
      },
      l = (u) => (c || (c = u), c),
      a = (u) =>
        typeof u != "function" ||
          !(r != null && r.length) && !(o != null && o.length)
          ? u
          : function (...g) {
            let v = W();
            if (v) {
              const d = v.$qrl$;
              v.$qrl$ = i;
              const x = v.$event$;
              v.$event$ === void 0 && (v.$event$ = this);
              try {
                return u.apply(this, g);
              } finally {
                v.$qrl$ = d, v.$event$ = x;
              }
            }
            return v = J(),
              v.$qrl$ = i,
              v.$event$ = this,
              G.call(this, v, u, ...g);
          },
      f = async (u) => {
        if (n !== null) return n;
        if (u && l(u), e === "") {
          const d = c.getAttribute(os), x = $s(c.ownerDocument, d);
          return i.resolved = n = x[Number(t)];
        }
        const g = xi(), v = W();
        if (s !== null) n = s().then((d) => i.resolved = n = a(d[t]));
        else {
          const d = Xt().importSymbol(c, e, t);
          n = A(d, (x) => i.resolved = n = a(x));
        }
        return n.finally(() => Ei(t, v == null ? void 0 : v.$element$, g)), n;
      },
      h = (u) => n !== null ? n : f(u);
    function p(u, g) {
      return (...v) =>
        A(h(), (d) => {
          if (!U(d)) throw M(10);
          if (g && g() === !1) return;
          const x = m(u);
          return G.call(this, x, d, ...v);
        });
    }
    const m = (u) => u == null ? J() : R(u) ? Is(u) : u, S = $ ?? t, y = ir(S);
    return Object.assign(i, {
      getSymbol: () => S,
      getHash: () => y,
      getCaptured: () => o,
      resolve: f,
      $resolveLazy$: h,
      $setContainer$: l,
      $chunk$: e,
      $symbol$: t,
      $refSymbol$: $,
      $hash$: y,
      getFn: p,
      $capture$: r,
      $captureRef$: o,
      dev: null,
      resolved: void 0,
    }),
      n && (n = A(n, (u) => i.resolved = n = a(u))),
      i;
  },
  ir = (e) => {
    const t = e.lastIndexOf("_");
    return t > -1 ? e.slice(t + 1) : e;
  };
const Yn = new Set(),
  Ei = (e, t, n) => {
    Yn.has(e) ||
      (Yn.add(e), cr("qsymbol", { symbol: e, element: t, reqTime: n }));
  },
  cr = (e, t) => {
    typeof document != "object" ||
      document.dispatchEvent(new CustomEvent(e, { bubbles: !1, detail: t }));
  },
  xi = () => typeof performance == "object" ? performance.now() : 0,
  ic = (e) => e,
  cc = function (e, t) {
    return t === void 0 && (t = e.toString()),
      nt("", "<sync>", e, null, null, null, null);
  },
  bi = (e) => {
    function t(n, s, r) {
      const o = e.$hash$.slice(0, 4) + ":" + (s || "");
      return ln(
        Be,
        { [_r]: e, [re]: n[re], [N]: n[N], children: n.children, props: n },
        r,
        o,
      );
    }
    return t[ft] = [e], t;
  },
  An = (e) => typeof e == "function" && e[ft] !== void 0,
  lc = (e, t) => {
    const { val: n, set: s, iCtx: r } = xe();
    if (n != null) return n;
    const o = U(e) ? G(void 0, e) : e;
    if ((t == null ? void 0 : t.reactive) === !1) return s(o), o;
    {
      const $ = tn(
        o,
        r.$renderCtx$.$static$.$containerState$,
        (t == null ? void 0 : t.deep) ?? !0 ? 1 : 0,
      );
      return s($), $;
    }
  };
function ac(e, t) {
  var s;
  const n = W();
  return ((s = n == null ? void 0 : n.$renderCtx$) == null
    ? void 0
    : s.$static$.$containerState$.$serverData$[e]) ?? t;
}
const Zn = new Map(),
  wi = (e, t) => {
    let n = Zn.get(t);
    return n || Zn.set(t, n = _i(e, t)), n;
  },
  _i = (e, t) => {
    const n = e.length, s = [], r = [];
    let o = 0, $ = o, c = qe, i = 0;
    for (; o < n;) {
      const p = o;
      let m = e.charCodeAt(o++);
      m === qi && (o++, m = pr);
      const S = Di[c];
      for (let y = 0; y < S.length; y++) {
        const u = S[y], [g, v, d] = u;
        if (
          (g === i || g === E || g === dt && st(i) || g === Wt && es(i)) &&
          (v === m || v === E || v === dt && st(m) ||
            v === te && !st(m) && m !== Cn || v === Wt && es(m)) &&
          (u.length == 3 || f(u))
        ) {
          if (u.length > 3 && (m = e.charCodeAt(o - 1)), d === q || d == de) {
            d === de &&
            (c !== lr || h()
              ? jn(m) || a(o - (v == te ? 1 : v == Bt ? 2 : 0))
              : (jn(m) ? l(o - 2) : a(o - 2), $++)), v === te && (o--, m = i);
            do c = r.pop() || qe, c === pe && (l(o - 1), $++); while (Ti(c));
          } else {r.push(c),
              c === pe && d === qe ? (l(o - 8), $ = o) : d === ar && a(p),
              c = d;}
          break;
        }
      }
      i = m;
    }
    return l(o), s.join("");
    function l(p) {
      s.push(e.substring($, p)), $ = p;
    }
    function a(p) {
      c === pe || h() || (l(p), s.push(".", "⭐️", t));
    }
    function f(p) {
      let m = 0;
      if (e.charCodeAt(o) === Ht) {
        for (let S = 1; S < 10; S++) {
          if (e.charCodeAt(o + S) === Ht) {
            m = S + 1;
            break;
          }
        }
      }
      e: for (let S = 3; S < p.length; S++) {
        const y = p[S];
        for (let u = 0; u < y.length; u++) {
          if ((e.charCodeAt(o + u + m) | zi) !== y.charCodeAt(u)) continue e;
        }
        return o += y.length + m, !0;
      }
      return !1;
    }
    function h() {
      return r.indexOf(pe) !== -1 || r.indexOf(In) !== -1;
    }
  },
  st = (e) =>
    e >= Ni && e <= Pi || e >= pr && e <= Ri || e >= Oi && e <= Li ||
    e >= 128 || e === ki || e === Ht,
  jn = (e) => e === Ae || e === Cn || e === hr || e === dr || st(e),
  Ti = (e) => e === ur || e === In || e === fr || e === pe,
  es = (e) => e === Mi || e === Ai || e === Ii || e === Ci,
  qe = 0,
  lr = 2,
  pe = 5,
  ar = 6,
  In = 10,
  ur = 11,
  fr = 12,
  q = 17,
  de = 18,
  E = 0,
  dt = 1,
  te = 2,
  Wt = 3,
  Ai = 9,
  Ii = 10,
  Ci = 13,
  Mi = 32,
  dr = 35,
  Bt = 41,
  Ht = 45,
  Cn = 46,
  Ni = 48,
  Pi = 57,
  Ae = 58,
  pr = 65,
  Ri = 90,
  hr = 91,
  qi = 92,
  ki = 95,
  zi = 32,
  Oi = 97,
  Li = 122,
  fe = [[E, 39, 14], [E, 34, 15], [E, 47, 16, "*"]],
  Di = [
    [
      [E, 42, lr],
      [E, hr, 7],
      [E, Ae, ar, ":", "before", "after", "first-letter", "first-line"],
      [E, Ae, pe, "global"],
      [E, Ae, 3, "has", "host-context", "not", "where", "is", "matches", "any"],
      [E, Ae, 4],
      [E, dt, 1],
      [E, Cn, 1],
      [E, dr, 1],
      [E, 64, In, "keyframe"],
      [E, 64, ur, "media", "supports", "container"],
      [E, 64, fr],
      [E, 123, 13],
      [47, 42, 16],
      [E, 59, q],
      [E, 125, q],
      [E, Bt, q],
      ...fe,
    ],
    [[E, te, de]],
    [[E, te, de]],
    [[E, 40, qe], [E, te, de]],
    [[E, 40, 8], [E, te, de]],
    [[E, 40, qe], [E, te, q]],
    [[E, te, q]],
    [[E, 93, de], [E, 39, 14], [E, 34, 15]],
    [[E, Bt, q], ...fe],
    [[E, 125, q], ...fe],
    [[E, 125, q], [Wt, dt, 1], [E, Ae, pe, "global"], [E, 123, 13], ...fe],
    [[E, 123, qe], [E, 59, q], ...fe],
    [[E, 59, q], [E, 123, 9], ...fe],
    [[E, 125, q], [E, 123, 13], [E, 40, 8], ...fe],
    [[E, 39, q]],
    [[E, 34, q]],
    [[42, 47, q]],
  ],
  uc = (e) => {
    mr(e, (t) => t, !1);
  },
  fc = (e) => ({ scopeId: "⭐️" + mr(e, wi, !0) }),
  mr = (e, t, n) => {
    const { val: s, set: r, iCtx: o, i: $, elCtx: c } = xe();
    if (s) return s;
    const i = Or(e, $), l = o.$renderCtx$.$static$.$containerState$;
    if (
      r(i),
        c.$appendStyles$ || (c.$appendStyles$ = []),
        c.$scopeIds$ || (c.$scopeIds$ = []),
        n && c.$scopeIds$.push(Lr(i)),
        l.$styleIds$.has(i)
    ) return i;
    l.$styleIds$.add(i);
    const a = e.$resolveLazy$(l.$containerEl$),
      f = (h) => {
        c.$appendStyles$,
          c.$appendStyles$.push({ styleId: i, content: t(h, i) });
      };
    return V(a) ? o.$waitOn$.push(a.then(f)) : f(a), i;
  },
  Fi = (e) => {
    const [t] = Ss();
    if (!t.submitted) return t.submit(e);
  },
  dc = Object.freeze(
    Object.defineProperty(
      { __proto__: null, _hW: ys, s_VXFb4R77gNw: Fi },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  );
export {
  $c as y,
  ac as a,
  Bi as v,
  bi as f,
  cc as s,
  dc as K,
  ds as D,
  ec as i,
  fc as I,
  Fi as s_VXFb4R77gNw,
  Fr as d,
  fs as g,
  Gi as j,
  Hi as u,
  ic as e,
  Ji as _,
  ji as B,
  Ki as J,
  ko as r,
  lc as b,
  ln as l,
  Lo as c,
  N as k,
  nc as h,
  oc as G,
  Qi as H,
  Qt as S,
  rc as q,
  rr as n,
  Rt as F,
  sc as E,
  Ss as p,
  tc as C,
  uc as x,
  Ui as o,
  Vi as z,
  Wi as m,
  Xi as t,
  Yi as A,
  ys as _hW,
  Zi as w,
};
