import { F as i, g as t, j as r, l as s, o } from "./q-BjteJSFI.js";
import { a as p, J as u } from "./q-DwB5CxdB.js";
const y = () => {
  const n = u(), a = p();
  return s(
    i,
    {
      children: [
        t("title", null, null, n.title, 1, null),
        t(
          "link",
          null,
          { rel: "canonical", href: o((l) => l.url.href, [a]) },
          null,
          3,
          null,
        ),
        t(
          "meta",
          null,
          {
            name: "viewport",
            content: "width=device-width, initial-scale=1.0",
          },
          null,
          3,
          null,
        ),
        t(
          "link",
          null,
          { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
          null,
          3,
          null,
        ),
        n.meta.map((l) => r("meta", { ...l }, null, 0, l.key)),
        n.links.map((l) => r("link", { ...l }, null, 0, l.key)),
        n.styles.map((l) => {
          var e;
          return r(
            "style",
            {
              ...l.props,
              ...(e = l.props) != null && e.dangerouslySetInnerHTML
                ? {}
                : { dangerouslySetInnerHTML: l.style },
            },
            null,
            0,
            l.key,
          );
        }),
        n.scripts.map((l) => {
          var e;
          return r(
            "script",
            {
              ...l.props,
              ...(e = l.props) != null && e.dangerouslySetInnerHTML
                ? {}
                : { dangerouslySetInnerHTML: l.script },
            },
            null,
            0,
            l.key,
          );
        }),
      ],
    },
    1,
    "OA_0",
  );
};
export { y as s_zrbrqoaqXSY };
