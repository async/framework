/* Qwik Service Worker */
const appBundles = [
  ["../service-worker.js", []],
  ["q--fTop3Yv.js", [37]],
  ["q-3PIAl2Np.js", [33], ["LkCVrojX09Y"]],
  ["q-B3XvjUxO.js", [37], ["8X6hWgnQRxE"]],
  ["q-BLxYZxko.js", [37], ["i0j0Ky0dmXI"]],
  ["q-BMNdx4VW.js", [37], ["J4V2qsF7Yxo"]],
  ["q-B_zZcot3.js", [37], ["zrbrqoaqXSY"]],
  ["q-BiCsrvS3.js", [37], ["gRRz00JItKA"]],
  ["q-BiMiFOIQ.js", [33], ["5Go3iiHXUB4"]],
  ["q-BjteJSFI.js", [], ["VXFb4R77gNw"]],
  ["q-BsnCGAsC.js", [20], ["cVOmaJkHacQ"]],
  ["q-Bt4-C-BG.js", [25], ["VkLNXphUh5s"]],
  ["q-C-2RWZNQ.js", [26], ["LQPhZ0qOjrk"]],
  ["q-C0GGDvc9.js", [7], ["UxlJFslpf0s"]],
  ["q-C5TRCQw7.js", [37]],
  ["q-CCKrurEM.js", [37], ["u0bwM0i5dA8"]],
  ["q-CFgkvVsA.js", [9], ["foRSjkQluCc"]],
  ["q-CNNHGku2.js", [37]],
  ["q-CV_cTLyj.js", [3], ["SNVSoEmabck"]],
  ["q-CZ28vsux.js", [], ["gNwUJOjjmEc"]],
  ["q-CbY785EZ.js", [37], ["zWWJzh5aCww"]],
  ["q-Cd1NamVw.js", [26], ["JtGc0nS5Nuo"]],
  ["q-CkhCG-BG.js", [7], ["kJCtKbc9zbk"]],
  ["q-ClnvXp-1.js", [7], ["NYEDprtA0Lw"]],
  ["q-CosRR0ig.js", [7], ["xYL1qOwPyDI"]],
  ["q-Cw5NrSYL.js", [37], ["JKHgMZ4xLZQ"]],
  ["q-Cx14osaz.js", [37], ["PxZ05oEiFy8"]],
  ["q-D-yYOA4u.js", [37], ["xY1vH3M9fB4"]],
  ["q-D0J5nS6x.js", [37], ["FusI6N08iPY"]],
  ["q-D4OMNnyu.js", [33], ["D04jAYuCnhM"]],
  ["q-DObQTaT4.js", [37], ["fle1EaVOup8"]],
  ["q-DSmPLiVB.js", [9], ["yogePwmF9dA"]],
  ["q-DT_NZ9Fj.js", [9], ["mBt9fIl89mc"]],
  ["q-DV_LWIAo.js", [37], ["aXA3vNn55QE"]],
  ["q-DZKwvOqz.js", [3], ["RZOV0QbO60Y"]],
  ["q-DcSXlCom.js", [3], ["Aqeo8lKe3IU"]],
  ["q-Dqj7ao8t.js", [37], ["3sccYCDd1Z0"]],
  ["q-DwB5CxdB.js", [9], ["d5PZYh2bVVI"]],
  ["q-DzIc0_di.js", [9], ["7gzriUtQs98"]],
  ["q-DzP1xvWc.js", [], ["zwO7CtYmrPQ"]],
  ["q-FGBBPsjp.js", [37], ["yPdH7y4ImA0"]],
  ["q-MJmz-4cW.js", [37], ["jDIH6nOiKOA"]],
  ["q-SYJ9TOvz.js", [3], ["i0OX5Main1M"]],
  ["q-TfmFxDYu.js", [9], ["iq02af90j2s"]],
  ["q-VUfyr0Cx.js", [26], ["HU55RV7VfPc"]],
  ["q-dUf1dB6j.js", [27], ["eptN2U9XgN4"]],
  ["q-ro2SQnRn.js", [27], ["fqdrEYGKbO8"]],
  ["q-vcqG2LQm.js", [37]],
];
const libraryBundleIds = [3];
const linkBundles = [[/^\/$/, [15, 11, 17, 24]], [/^\/demo\/flower\/?$/, [
  15,
  11,
  14,
  26,
]], [/^\/demo\/todolist\/?$/, [15, 11, 5]]];
const p = (t, e) => e.filter((n) => !t.some((c) => n.endsWith(c[0]))),
  q = (t, e) => !!e && !B(e),
  B = (t) => {
    const e = t.headers.get("Cache-Control") || "";
    return e.includes("no-cache") || e.includes("max-age=0");
  },
  N = (t, e) => t.some((n) => e.endsWith("/" + n[0])),
  W = (t, e) => t.find((n) => n[0] === e),
  g = (t, e) => e.map((n) => t[n] ? t[n][0] : null),
  w = (t, e) => e.map((n) => t.get(n)).filter((n) => n != null),
  C = (t) => {
    const e = new Map();
    for (const n of t) {
      const c = n[2];
      if (c) { for (const o of c) e.set(o, n[0]); }
    }
    return e;
  },
  k = (t, e, n, c) =>
    new Promise((o, a) => {
      const s = c.url, r = n.get(s);
      if (r) r.push([o, a]);
      else {
        const l = (f) => {
            const i = n.get(s);
            if (i) {
              n.delete(s);
              for (const [d] of i) d(f.clone());
            } else o(f.clone());
          },
          u = (f) => {
            const i = n.get(s);
            if (i) {
              n.delete(s);
              for (const [d, U] of i) U(f);
            } else a(f);
          };
        n.set(s, [[o, a]]),
          t.match(s).then((f) => {
            if (q(c, f)) l(f);
            else {return e(c).then(async (i) => {
                i.ok && await t.put(s, i.clone()), l(i);
              });}
          }).catch((f) =>
            t.match(s).then((i) => {
              i ? l(i) : u(f);
            })
          );
      }
    }),
  y = "QwikBuild",
  b = new Set(),
  A = new Map(),
  h = [],
  m = (t, e, n, c, o, a = !1) => {
    Array.isArray(o) && v(o, t, c, a), L(e, n);
  };
function v(t, e, n, c) {
  for (const o of t) {
    try {
      const a = W(e, o);
      if (a) {
        const s = g(e, a[1]), r = new URL(o, n).href, l = h.indexOf(r);
        l > -1
          ? c && (h.splice(l, 1), h.unshift(r))
          : (c ? h.unshift(r) : h.push(r), v(s, e, n, c));
      }
    } catch (a) {
      console.error(a);
    }
  }
}
function L(t, e) {
  for (; h.length > 0 && A.size < 6;) {
    const n = h.shift();
    if (!b.has(n)) {
      const c = new Request(n);
      b.add(n),
        k(t, e, A, c).catch(() => {
          b.delete(n);
        }).finally(() => L(t, e));
    }
  }
}
const E = (t, e, n, c, o, a, s) => {
    try {
      m(t, c, o, a, g(t, e));
    } catch (r) {
      console.error(r);
    }
    for (const r of s) {
      try {
        for (const l of n) {
          const [u, f] = l;
          if (u.test(r)) {
            m(t, c, o, a, g(t, f));
            break;
          }
        }
      } catch (l) {
        console.error(l);
      }
    }
  },
  T = (t, e, n, c) => {
    try {
      const { baseUrl: o, requestedBundleName: a } = x(c);
      m(t, e, n, o, [a], !0);
    } catch (o) {
      console.error(o);
    }
  };
function x(t) {
  const e = t.href.split("/"), n = e[e.length - 1];
  return e[e.length - 1] = "",
    { baseUrl: new URL(e.join("/")), requestedBundleName: n };
}
const P = (t, e, n, c) => {
    const o = t.fetch.bind(t), a = C(e);
    t.addEventListener("activate", (s) => {
      (async () => {
        try {
          s.waitUntil(
            t.caches.keys().then((i) =>
              Promise.all(i.map((d) => {
                if (d !== y) return caches.delete(d);
              }))
            ),
          );
          const r = await t.caches.open(y),
            u = (await r.keys()).map((i) => i.url),
            f = p(e, u);
          await Promise.all(f.map((i) => r.delete(i)));
        } catch (r) {
          console.error(r);
        }
      })();
    }),
      t.addEventListener("message", async ({ data: s }) => {
        if (s.type === "qprefetch" && typeof s.base == "string") {
          const r = await t.caches.open(y), l = new URL(s.base, t.origin);
          Array.isArray(s.links) && E(e, n, c, r, o, l, s.links),
            Array.isArray(s.bundles) && m(e, r, o, l, s.bundles),
            Array.isArray(s.symbols) && m(e, r, o, l, w(a, s.symbols));
        }
      }),
      t.addEventListener("fetch", (s) => {
        const r = s.request;
        if (r.method === "GET") {
          const l = new URL(r.url);
          N(e, l.pathname) &&
            s.respondWith(
              t.caches.open(y).then((u) => (T(e, u, o, l), k(u, o, A, r))),
            );
        }
      });
  },
  Q = () => {
    typeof self < "u" && typeof appBundles < "u" &&
      P(self, appBundles, libraryBundleIds, linkBundles);
  };
Q();
addEventListener("install", () => self.skipWaiting());
addEventListener("activate", () => self.clients.claim());
