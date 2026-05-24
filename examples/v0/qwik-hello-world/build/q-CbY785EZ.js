import {
  _hW as p,
  b as n,
  l as C,
  q as v,
  S as w,
  t as e,
  v as t,
} from "./q-BjteJSFI.js";
import {
  _ as x,
  C as f,
  c as g,
  D as S,
  d as h,
  e as z,
  f as P,
  h as k,
  i as y,
  R,
} from "./q-DwB5CxdB.js";
const j = async () => {
    console.warn("QwikCityMockProvider: goto not provided");
  },
  I = Object.freeze(
    Object.defineProperty(
      { __proto__: null, _hW: p, s_zWWJzh5aCww: j },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  q = (o) => {
    const s = o.url ?? "http://localhost/",
      a = new URL(s),
      r = n({
        url: a,
        params: o.params ?? {},
        isNavigating: !1,
        prevUrl: void 0,
      }, { deep: !1 }),
      c = e({}),
      i = e({ type: "initial", dest: a }),
      l = o.goto ??
        v(
          () => x(() => Promise.resolve().then(() => I), void 0),
          "s_zWWJzh5aCww",
        ),
      d = n(g, { deep: !1 }),
      _ = n({ headings: void 0, menu: void 0 }, { deep: !1 }),
      u = e(),
      m = e();
    return t(f, _),
      t(h, u),
      t(S, d),
      t(R, r),
      t(z, l),
      t(P, c),
      t(k, m),
      t(y, i),
      C(w, null, 3, "P4_4");
  };
export { j as s_zWWJzh5aCww, p as _hW, q as s };
