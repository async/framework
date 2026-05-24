import {
  _hW as h,
  f as _,
  g as t,
  H as d,
  h as i,
  o as u,
  p as l,
  q as n,
  t as c,
} from "./q-BjteJSFI.js";
import { _ as s } from "./q-DwB5CxdB.js";
const o = [{
    message:
      "Press and hold the <b>ALT/Option</b> key to activate 'Click-to-Source' mode",
  }, {
    message:
      "Select the title of this page while keeping the <b>ALT/Option</b> key pressed",
    hint:
      'Edit the title and save the changes. If your editor does not open, have a look at <a href="https://github.com/yyx990803/launch-editor#supported-editors" target="_blank">this page</a> to set the correct <code>LAUNCH_EDITOR</code> value.',
  }, {
    message:
      "<b>Update</b> now the <code>routeLoader$</code> defined in the <code>src/routes/layout.tsx</code> file",
    hint:
      "Instead of returning the current date, you could return any possible string.<br />The output is displayed in the footer.",
  }, {
    message: "Create a <b>new Route</b> called <code>/me</code>",
    hint:
      'Create a new directory called <code>me</code> in <code>src/routes</code>. Within this directory create a <code>index.tsx</code> file or copy the <code>src/routes/index.tsx</code> file. Your new route is now accessible <a href="/me" target="_blank">here</a> ✨',
  }, {
    message: "Time to have a look at <b>Forms</b>",
    hint:
      'Open <a href="/demo/todolist" target="_blank">the TODO list App</a> and add some items to the list. Try the same with disabled JavaScript 🐰',
  }, {
    message: "<b>Congratulations!</b> You are now familiar with the basics! 🎉",
    hint:
      "If you need further info on how to use qwik, have a look at <a href='https://qwik.dev' target='_blank'>qwik.dev</a> or join the <a href='https://qwik.dev/chat' target='_blank'>Discord channel</a>.",
  }],
  E = _(
    n(() => s(() => Promise.resolve().then(() => v), void 0), "s_kJCtKbc9zbk"),
  ),
  p = () => {
    const [e] = l();
    return e.value++;
  },
  g = Object.freeze(
    Object.defineProperty(
      { __proto__: null, s_gRRz00JItKA: p },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  b = "_gettingstarted_32zqp_1",
  m = "_intro_32zqp_14",
  f = "_hint_32zqp_19",
  r = { gettingstarted: b, intro: m, hint: f },
  S = () => {
    const e = c(0);
    return d(
      "keydown",
      n(
        () => s(() => Promise.resolve().then(() => x), void 0),
        "s_UxlJFslpf0s",
        [e],
      ),
    ),
      t(
        "div",
        null,
        { class: "container container-purple container-center" },
        [
          t(
            "h2",
            null,
            null,
            [
              "Time for a",
              t("br", null, null, null, 3, null),
              t("span", null, { class: "highlight" }, "qwik intro", 3, null),
              "?",
            ],
            3,
            null,
          ),
          t(
            "div",
            null,
            { class: r.gettingstarted },
            [
              t(
                "div",
                { dangerouslySetInnerHTML: i(o[e.value], "message") },
                { class: r.intro },
                null,
                3,
                null,
              ),
              t(
                "span",
                { dangerouslySetInnerHTML: i(o[e.value], "hint") },
                { class: r.hint },
                null,
                3,
                null,
              ),
            ],
            1,
            null,
          ),
          e.value + 1 < o.length
            ? t(
              "button",
              null,
              {
                class: "button-dark",
                onClick$: n(
                  () => s(() => Promise.resolve().then(() => g), void 0),
                  "s_gRRz00JItKA",
                  [e],
                ),
              },
              [
                "Continue with Step ",
                u((a) => a.value + 2, [e]),
                " of",
                " ",
                o.length,
              ],
              3,
              "W5_0",
            )
            : t(
              "button",
              null,
              {
                class: "button-dark",
                onClick$: n(
                  () => s(() => Promise.resolve().then(() => y), void 0),
                  "s_NYEDprtA0Lw",
                  [e],
                ),
              },
              "Re-Start",
              3,
              null,
            ),
        ],
        1,
        "W5_1",
      );
  },
  v = Object.freeze(
    Object.defineProperty(
      { __proto__: null, s_kJCtKbc9zbk: S },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  k = () => {
    const [e] = l();
    return e.value = 0;
  },
  y = Object.freeze(
    Object.defineProperty(
      { __proto__: null, s_NYEDprtA0Lw: k },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  w = (e) => {
    const [a] = l();
    e.key === "Alt" && (a.value = 1);
  },
  x = Object.freeze(
    Object.defineProperty(
      { __proto__: null, _hW: h, s_UxlJFslpf0s: w },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  );
export { E as S, k as a, p as s_gRRz00JItKA, S as s, w as b };
