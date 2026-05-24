import { _ as s, a as c } from "./q-DwB5CxdB.js";
import {
  _hW as p,
  b as d,
  g as r,
  I as u,
  J as _,
  o as l,
  p as i,
  q as a,
} from "./q-BjteJSFI.js";
const b = () => {
    u(a(
      () => s(() => Promise.resolve().then(() => y), void 0),
      "s_HU55RV7VfPc",
    ));
    const n = c(), e = d({ count: 0, number: 20 });
    return _(
      a(
        () => s(() => Promise.resolve().then(() => h), void 0),
        "s_LQPhZ0qOjrk",
        [e],
      ),
    ),
      r(
        "div",
        null,
        { class: "container container-center" },
        [
          r(
            "div",
            null,
            { role: "presentation", class: "ellipsis" },
            null,
            3,
            null,
          ),
          r(
            "h1",
            null,
            null,
            [
              r("span", null, { class: "highlight" }, "Generate", 3, null),
              " Flowers",
            ],
            3,
            null,
          ),
          r(
            "input",
            null,
            {
              class: "input",
              type: "range",
              value: l((t) => t.number, [e]),
              max: 50,
              onInput$: a(
                () => s(() => Promise.resolve().then(() => f), void 0),
                "s_JtGc0nS5Nuo",
                [e],
              ),
            },
            null,
            3,
            null,
          ),
          r(
            "div",
            null,
            {
              style: l((t) => ({ "--state": `${t.count * .1}` }), [e]),
              class: l(
                (t) => ({
                  host: !0,
                  pride: t.url.searchParams.get("pride") === "true",
                }),
                [n],
              ),
            },
            Array.from({ length: e.number }, (t, o) =>
              r(
                "div",
                {
                  class: { square: !0, odd: o % 2 === 0 },
                  style: { "--index": `${o + 1}` },
                },
                null,
                null,
                3,
                o,
              )).reverse(),
            1,
            null,
          ),
        ],
        1,
        "IA_0",
      );
  },
  q = Object.freeze(
    Object.defineProperty(
      { __proto__: null, s_PxZ05oEiFy8: b },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  v = ({ cleanup: n }) => {
    const [e] = i(), t = setTimeout(() => e.count = 1, 500);
    n(() => clearTimeout(t));
    const o = setInterval(() => e.count++, 7e3);
    n(() => clearInterval(o));
  },
  h = Object.freeze(
    Object.defineProperty(
      { __proto__: null, _hW: p, s_LQPhZ0qOjrk: v },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  m = (n, e) => {
    const [t] = i();
    t.number = e.valueAsNumber;
  },
  f = Object.freeze(
    Object.defineProperty(
      { __proto__: null, s_JtGc0nS5Nuo: m },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  g =
    ".host{display:grid;align-items:center;justify-content:center;justify-items:center;--rotation: 225deg;--size-step: 10px;--odd-color-step: 5;--even-color-step: 5;--center: 12;width:100%;height:500px;contain:strict}h1{margin-bottom:60px}.input{width:60%}.square{--size: calc(40px + var(--index) * var(--size-step));display:block;width:var(--size);height:var(--size);transform:rotate(calc(var(--rotation) * var(--state) * (var(--center) - var(--index))));transition-property:transform,border-color;transition-duration:5s;transition-timing-function:ease-in-out;grid-area:1 / 1;background:#fff;border-width:2px;border-style:solid;border-color:#000;box-sizing:border-box;will-change:transform,border-color;contain:strict}.square.odd{--luminance: calc(1 - calc(calc(var(--index) * var(--odd-color-step)) / 256));background:rgb(calc(172 * var(--luminance)),calc(127 * var(--luminance)),calc(244 * var(--luminance)))}.pride .square:nth-child(12n+1){background:#e70000}.pride .square:nth-child(12n+3){background:#ff8c00}.pride .square:nth-child(12n+5){background:#ffef00}.pride .square:nth-child(12n+7){background:#00811f}.pride .square:nth-child(12n+9){background:#04f}.pride .square:nth-child(12n+11){background:#760089}",
  x = g,
  y = Object.freeze(
    Object.defineProperty(
      { __proto__: null, s_HU55RV7VfPc: x },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  );
export { b as s_PxZ05oEiFy8, m as a, q as i, v as s, x as b };
