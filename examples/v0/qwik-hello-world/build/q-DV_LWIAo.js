import {
  _hW as v,
  f as u,
  g as _,
  k as a,
  l as c,
  o as i,
  p as r,
  q as e,
  t as l,
} from "./q-BjteJSFI.js";
import { _ as n } from "./q-DwB5CxdB.js";
const p = (t) => {
    const [o] = r();
    t < 0 || t > 100 || (o.value = t);
  },
  b = Object.freeze(
    Object.defineProperty(
      { __proto__: null, _hW: v, s_aXA3vNn55QE: p },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  m = () => {
    const [t, o] = r();
    return o(t.value - 1);
  },
  d = Object.freeze(
    Object.defineProperty(
      { __proto__: null, s_D04jAYuCnhM: m },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  j = u(e(() => n(() => import("./q-DzIc0_di.js"), []), "s_7gzriUtQs98")),
  g = { "counter-wrapper": "_counter-wrapper_43sys_1" },
  y = () => {
    const t = l(70),
      o = e(
        () => n(() => Promise.resolve().then(() => b), void 0),
        "s_aXA3vNn55QE",
        [t],
      );
    return _(
      "div",
      null,
      { class: g["counter-wrapper"] },
      [
        _(
          "button",
          null,
          {
            class: "button-dark button-small",
            onClick$: e(
              () => n(() => Promise.resolve().then(() => d), void 0),
              "s_D04jAYuCnhM",
              [t, o],
            ),
          },
          "-",
          3,
          null,
        ),
        c(
          j,
          {
            get value() {
              return t.value;
            },
            [a]: { value: i((s) => s.value, [t]) },
          },
          3,
          "no_0",
        ),
        _(
          "button",
          null,
          {
            class: "button-dark button-small",
            onClick$: e(
              () => n(() => Promise.resolve().then(() => E), void 0),
              "s_LkCVrojX09Y",
              [t, o],
            ),
          },
          "+",
          3,
          null,
        ),
      ],
      1,
      "no_1",
    );
  },
  f = () => {
    const [t, o] = r();
    return o(t.value + 1);
  },
  E = Object.freeze(
    Object.defineProperty(
      { __proto__: null, s_LkCVrojX09Y: f },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  );
export { f as b, m as s, p as s_aXA3vNn55QE, v as _hW, y as a };
