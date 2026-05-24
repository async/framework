import { _ as u } from "./q-DwB5CxdB.js";
import { g as l, k as n, l as r, q as o } from "./q-BjteJSFI.js";
const a =
    "/assets/uOW82FhY-thunder.webp 200w, /assets/4fKdvPuU-thunder.webp 400w, /assets/D1GWFvML-thunder.webp 600w, /assets/CoVGs9lf-thunder.webp 800w, /assets/DD7BZciK-thunder.webp 1200w",
  h = 1200,
  i = 1280,
  _ = { srcSet: a, width: h, height: i };
function c(e, s, g, p) {
  return l(
    "img",
    { decoding: "async", loading: "lazy", ...e },
    _,
    void 0,
    3,
    s,
  );
}
const d = "_hero_resu5_1",
  t = {
    hero: d,
    "hero-image": "_hero-image_resu5_12",
    "button-group": "_button-group_resu5_28",
  },
  m = () =>
    l(
      "div",
      null,
      { class: ["container", t.hero] },
      [
        r(
          c,
          {
            get class() {
              return t["hero-image"];
            },
            alt: "Image thunder",
            [n]: { class: n, alt: n },
          },
          3,
          "nG_0",
        ),
        l(
          "h1",
          null,
          null,
          [
            "So ",
            l("span", null, { class: "highlight" }, "fantastic", 3, null),
            l("br", null, null, null, 3, null),
            "to have ",
            l("span", null, { class: "highlight" }, "you", 3, null),
            " here",
          ],
          3,
          null,
        ),
        l("p", null, null, "Have fun building your App with Qwik.", 3, null),
        l(
          "div",
          null,
          { class: t["button-group"] },
          [
            l(
              "button",
              null,
              {
                onClick$: o(
                  () => u(() => import("./q-DzP1xvWc.js"), []),
                  "s_zwO7CtYmrPQ",
                ),
              },
              "Time to celebrate",
              3,
              null,
            ),
            l(
              "a",
              null,
              {
                href: "https://qwik.dev/docs",
                target: "_blank",
                class: "button button-dark",
              },
              "Explore the docs",
              3,
              null,
            ),
          ],
          3,
          null,
        ),
      ],
      1,
      "nG_1",
    );
export { m as s_fle1EaVOup8 };
