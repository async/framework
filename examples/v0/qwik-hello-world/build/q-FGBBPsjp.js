import { d as i, y as c } from "./q-DwB5CxdB.js";
import {
  a as u,
  D as f,
  F as _,
  g as h,
  i as d,
  l,
  s as v,
  u as m,
} from "./q-BjteJSFI.js";
const p = () => {
  if (!u("containerAttributes")) {
    throw new Error(
      "PrefetchServiceWorker component must be rendered on the server.",
    );
  }
  d();
  const e = m(i);
  if (e.value && e.value.length > 0) {
    const a = e.value.length;
    let n = null;
    for (let t = a - 1; t >= 0; t--) {
      e.value[t].default &&
        (n = l(e.value[t].default, { children: n }, 1, "P4_0"));
    }
    return l(
      _,
      {
        children: [
          n,
          h(
            "script",
            {
              "document:onQCInit$": c,
              "document:onQInit$": v(
                () => {
                  ((t, o) => {
                    var s;
                    if (!t._qcs && o.scrollRestoration === "manual") {
                      t._qcs = !0;
                      const r = (s = o.state) == null ? void 0 : s._qCityScroll;
                      r && t.scrollTo(r.x, r.y),
                        document.dispatchEvent(new Event("qcinit"));
                    }
                  })(window, history);
                },
                '()=>{((window1,history1)=>{if(!window1._qcs&&history1.scrollRestoration==="manual"){window1._qcs=true;const scrollState=history1.state?._qCityScroll;if(scrollState){window1.scrollTo(scrollState.x,scrollState.y);}document.dispatchEvent(new Event("qcinit"));}})(window,history);}',
              ),
            },
            null,
            null,
            2,
            "P4_1",
          ),
        ],
      },
      1,
      "P4_2",
    );
  }
  return f;
};
export { p as s_yPdH7y4ImA0 };
