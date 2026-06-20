export const DEFAULT_FRAMEWORKS = ["keyed/js-only", "keyed/react", "keyed/qwik-v1", "keyed/qwik-v2", "keyed/solid-v1", "keyed/solid-v2"];

const rowIdSelector = (row) => `tbody>tr:nth-of-type(${row})>td:nth-of-type(1)`;
const rowLabelSelector = (row) => `tbody>tr:nth-of-type(${row})>td:nth-of-type(2)>a`;
const rowDeleteSelector = (row) => `tbody>tr:nth-of-type(${row})>td:nth-of-type(3)>a>span:nth-of-type(1)`;

async function expectVisible(page, selector) {
  await page.locator(selector).waitFor({ state: "visible", timeout: 10_000 });
}

async function expectMissing(page, selector) {
  await page.locator(selector).waitFor({ state: "detached", timeout: 10_000 }).catch(async () => {
    const count = await page.locator(selector).count();
    if (count !== 0) throw new Error(`Expected ${selector} to be missing, found ${count}`);
  });
}

async function expectText(page, selector, expected) {
  await expectVisible(page, selector);
  const locator = page.locator(selector).first();
  await page.waitForFunction(
    ({ selector, expected }) => document.querySelector(selector)?.textContent?.includes(expected),
    { selector, expected },
    { timeout: 10_000 },
  );
  const text = await locator.innerText();
  if (!text.includes(expected)) throw new Error(`Expected ${selector} to contain ${expected}, got ${text}`);
}

async function expectClass(page, selector, className) {
  await expectVisible(page, selector);
  const locator = page.locator(selector).first();
  await page.waitForFunction(
    ({ selector, className }) => document.querySelector(selector)?.classList.contains(className),
    { selector, className },
    { timeout: 10_000 },
  );
  const classes = await locator.evaluate((node) => Array.from(node.classList));
  if (!classes.includes(className)) throw new Error(`Expected ${selector} to include class ${className}, got ${classes.join(" ")}`);
}

async function click(page, selector) {
  await expectVisible(page, selector);
  await page.locator(selector).first().click();
}

async function warmCreateAndClear(page, warmups) {
  for (let index = 0; index < warmups; index++) {
    await click(page, "#run");
    await expectText(page, rowIdSelector(1), String(index * 1000 + 1));
    await click(page, "#clear");
    await expectMissing(page, rowIdSelector(1000));
  }
}

export const BENCHMARKS = [
  {
    id: "01_run1k",
    label: "create 1,000 rows",
    defaultWarmups: 1,
    async init(page, warmups) {
      await warmCreateAndClear(page, warmups);
    },
    async run(page, warmups) {
      await click(page, "#run");
      await expectText(page, rowIdSelector(1000), String((warmups + 1) * 1000));
    },
  },
  {
    id: "02_replace1k",
    label: "replace 1,000 rows",
    defaultWarmups: 1,
    async init(page, warmups) {
      await expectVisible(page, "#run");
      for (let index = 0; index < warmups; index++) {
        await click(page, "#run");
        await expectText(page, rowIdSelector(1), String(index * 1000 + 1));
      }
    },
    async run(page, warmups) {
      await click(page, "#run");
      await expectText(page, rowIdSelector(1), String(warmups * 1000 + 1));
    },
  },
  {
    id: "03_update10th1k_x16",
    label: "update every 10th row",
    defaultWarmups: 1,
    async init(page, warmups) {
      await click(page, "#run");
      await expectVisible(page, rowIdSelector(1000));
      for (let index = 0; index < warmups; index++) {
        await click(page, "#update");
        await expectText(page, rowLabelSelector(991), " !!!".repeat(index + 1));
      }
    },
    async run(page, warmups) {
      await click(page, "#update");
      await expectText(page, rowLabelSelector(991), " !!!".repeat(warmups + 1));
    },
  },
  {
    id: "04_select1k",
    label: "select row",
    defaultWarmups: 1,
    async init(page) {
      await click(page, "#run");
      await expectText(page, rowIdSelector(1000), "1000");
      await click(page, rowLabelSelector(5));
      await expectClass(page, "tbody>tr:nth-of-type(5)", "danger");
    },
    async run(page) {
      await click(page, rowLabelSelector(2));
      await expectClass(page, "tbody>tr:nth-of-type(2)", "danger");
    },
  },
  {
    id: "05_swap1k",
    label: "swap rows",
    defaultWarmups: 1,
    async init(page, warmups) {
      await click(page, "#run");
      await expectVisible(page, rowIdSelector(1000));
      for (let index = 0; index < warmups; index++) {
        await click(page, "#swaprows");
      }
    },
    async run(page, warmups) {
      await click(page, "#swaprows");
      const oddAfterRun = (warmups + 1) % 2 === 1;
      await expectText(page, rowIdSelector(2), oddAfterRun ? "999" : "2");
      await expectText(page, rowIdSelector(999), oddAfterRun ? "2" : "999");
    },
  },
  {
    id: "06_remove-one-1k",
    label: "remove one row",
    defaultWarmups: 0,
    async init(page) {
      await click(page, "#run");
      await expectVisible(page, rowIdSelector(1000));
    },
    async run(page) {
      await click(page, rowDeleteSelector(4));
      await expectText(page, rowIdSelector(4), "5");
    },
  },
  {
    id: "07_create10k",
    label: "create 10,000 rows",
    defaultWarmups: 0,
    async init(page) {
      await expectVisible(page, "#runlots");
    },
    async run(page) {
      await click(page, "#runlots");
      await expectVisible(page, rowLabelSelector(10000));
    },
  },
  {
    id: "08_create1k-after1k_x2",
    label: "append 1,000 rows",
    defaultWarmups: 0,
    async init(page) {
      await click(page, "#run");
      await expectVisible(page, rowIdSelector(1000));
    },
    async run(page) {
      await click(page, "#add");
      await expectVisible(page, rowIdSelector(2000));
    },
  },
  {
    id: "09_clear1k_x8",
    label: "clear rows",
    defaultWarmups: 0,
    async init(page) {
      await click(page, "#run");
      await expectVisible(page, rowIdSelector(1000));
    },
    async run(page) {
      await click(page, "#clear");
      await expectMissing(page, rowIdSelector(1000));
    },
  },
];

export function selectBenchmarks(filters) {
  if (filters.length === 0) return BENCHMARKS;
  return BENCHMARKS.filter((benchmark) => filters.some((filter) => benchmark.id.includes(filter)));
}
