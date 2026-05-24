import { g as l } from "./q-BjteJSFI.js";
const s = "_wrapper_1v6hy_1",
  u = "_gauge_1v6hy_5",
  t = "_value_1v6hy_9",
  n = { wrapper: s, gauge: u, value: t },
  o = (e) => {
    const r = (e.value ?? 50) < 0 || (e.value ?? 50) > 100 ? 50 : e.value ?? 50;
    return l(
      "div",
      null,
      { class: n.wrapper },
      [
        l(
          "svg",
          null,
          { viewBox: "0 0 120 120", class: n.gauge },
          [
            l(
              "defs",
              null,
              null,
              l(
                "linearGradient",
                null,
                { id: "gradient", x1: "0%", y1: "0%", x2: "100%", y2: "100%" },
                [
                  l(
                    "stop",
                    null,
                    { offset: "0%", "stop-color": "#18B6F6" },
                    null,
                    3,
                    null,
                  ),
                  l(
                    "stop",
                    null,
                    { offset: "1000%", "stop-color": "#AC7FF4" },
                    null,
                    3,
                    null,
                  ),
                ],
                3,
                null,
              ),
              3,
              null,
            ),
            l(
              "circle",
              null,
              {
                r: "56",
                cx: "60",
                cy: "60",
                "stroke-width": "8",
                style: "fill: #000; stroke: #0000",
              },
              null,
              3,
              null,
            ),
            l(
              "circle",
              {
                style: `transform: rotate(-87.9537deg); stroke-dasharray: ${
                  r * 3.51
                }, 351.858; fill:none; transform-origin:50% 50%; stroke-linecap:round; stroke:url(#gradient)`,
              },
              { r: "56", cx: "60", cy: "60", "stroke-width": "8" },
              null,
              3,
              null,
            ),
          ],
          1,
          null,
        ),
        l("span", null, { class: n.value }, r, 1, null),
      ],
      1,
      "cu_0",
    );
  };
export { o as s_7gzriUtQs98 };
