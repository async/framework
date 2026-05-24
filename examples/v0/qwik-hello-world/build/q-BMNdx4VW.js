import { _ as m, K as _, N as p, O as d, P as y } from "./q-DwB5CxdB.js";
import {
  F as x,
  f as h,
  G as o,
  g as t,
  h as v,
  k as n,
  l as s,
  q as f,
} from "./q-BjteJSFI.js";
const g = "_list_1ofyy_1",
  b = "_empty_1ofyy_9",
  P = "_input_1ofyy_22",
  A = "_hint_1ofyy_32",
  l = { list: g, empty: b, input: P, hint: A },
  Q = [],
  i = _(o("s_VMJUTdq2hzw")),
  a = p(o("s_tCQ608gnjnQ"), d()),
  T = h(
    f(() => m(() => Promise.resolve().then(() => O), void 0), "s_J4V2qsF7Yxo"),
  ),
  j = { title: "Qwik Todo List" },
  w = Object.freeze(
    Object.defineProperty(
      {
        __proto__: null,
        default: T,
        head: j,
        list: Q,
        useAddToListAction: a,
        useListLoader: i,
      },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  L = () => {
    const e = i(), r = a();
    return s(
      x,
      {
        children: [
          t(
            "div",
            null,
            { class: "container container-center" },
            t(
              "h1",
              null,
              null,
              [
                t("span", null, { class: "highlight" }, "TODO", 3, null),
                " List",
              ],
              3,
              null,
            ),
            3,
            null,
          ),
          t(
            "div",
            null,
            { role: "presentation", class: "ellipsis" },
            null,
            3,
            null,
          ),
          t(
            "div",
            null,
            { class: "container container-center" },
            e.value.length === 0
              ? t("span", null, { class: l.empty }, "No items found", 3, "AP_0")
              : t(
                "ul",
                null,
                { class: l.list },
                e.value.map((u, c) =>
                  t("li", null, null, v(u, "text"), 1, `items-${c}`)
                ),
                1,
                null,
              ),
            1,
            null,
          ),
          t(
            "div",
            null,
            { class: "container container-center" },
            [
              s(
                y,
                {
                  action: r,
                  spaReset: !0,
                  children: [
                    t(
                      "input",
                      null,
                      {
                        type: "text",
                        name: "text",
                        required: !0,
                        class: l.input,
                      },
                      null,
                      3,
                      null,
                    ),
                    " ",
                    t(
                      "button",
                      null,
                      { type: "submit", class: "button-dark" },
                      "Add item",
                      3,
                      null,
                    ),
                  ],
                  [n]: { action: n, spaReset: n },
                },
                3,
                "AP_1",
              ),
              t(
                "p",
                null,
                { class: l.hint },
                "PS: This little app works even when JavaScript is disabled.",
                3,
                null,
              ),
            ],
            1,
            null,
          ),
        ],
      },
      1,
      "AP_2",
    );
  },
  O = Object.freeze(
    Object.defineProperty(
      { __proto__: null, s_J4V2qsF7Yxo: L },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  );
export { L as s_J4V2qsF7Yxo, w as i };
