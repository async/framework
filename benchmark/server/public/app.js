import { Async } from "/framework/browser.js";

const root = document.getElementById("benchmark-ui");
const status = document.getElementById("status");
const appsPanel = document.getElementById("apps-panel");
const resultsPanel = document.getElementById("results-panel");
const appsGrid = document.getElementById("apps-grid");
const resultsMeta = document.getElementById("results-meta");
const resultsOverall = document.getElementById("results-overall");
const resultsGroups = document.getElementById("results-groups");

Async.use({
  handler: {
    "view.apps": () => setView("apps"),
    "view.results": () => setView("results"),
  },
});

Async.start({ root, router: false });

await Promise.all([renderApps(), renderResults()]);
setView(root.dataset.view === "results" ? "results" : "apps");

async function renderApps() {
  const frameworks = await fetchJson("/ls");
  appsGrid.replaceChildren(
    ...frameworks.map((framework) => {
      const link = document.createElement("a");
      link.className = "rounded border border-slate-200 bg-white px-4 py-2.5 text-sky-700 transition hover:text-sky-900";
      link.href = `/${framework.uri}/index.html`;
      link.textContent = framework.frameworkVersionString;
      return link;
    }),
  );
}

async function renderResults() {
  const results = await fetchJson("/results.json").catch(() => null);
  if (!results) {
    resultsMeta.textContent = "No benchmark results found. Run npm run benchmark:run first.";
    return;
  }

  resultsMeta.textContent = `${results.generatedAt} · ${results.mode} · ${results.browser} · ${results.frameworkCount} frameworks · ${results.benchmarkCount} benchmarks · ${results.results.length} rows`;
  const enriched = enrichResults(results.results);
  resultsOverall.replaceChildren(renderOverallTable(enriched));
  resultsGroups.replaceChildren(...groupByBenchmark(enriched).map(renderBenchmarkGroup));
}

function renderOverallTable(results) {
  const frameworks = new Map();
  for (const result of results) {
    const current = frameworks.get(result.frameworkVersion) ?? {
      frameworkVersion: result.frameworkVersion,
      framework: result.framework,
      totalRatios: [],
      memoryRatios: [],
      gzipKB: result.gzipKB,
    };
    current.totalRatios.push(result.totalRatio);
    current.memoryRatios.push(result.memoryRatio);
    current.gzipKB = result.gzipKB;
    frameworks.set(result.frameworkVersion, current);
  }

  const rows = [...frameworks.values()]
    .map((framework) => ({
      ...framework,
      totalScore: geometricMean(framework.totalRatios),
      memoryScore: geometricMean(framework.memoryRatios),
    }))
    .sort((a, b) => a.totalScore - b.totalScore);
  const bestTotal = Math.min(...rows.map((row) => row.totalScore));
  const bestMemory = Math.min(...rows.map((row) => row.memoryScore));
  const bestSize = Math.min(...rows.map((row) => row.gzipKB));

  return renderTable(
    ["Rank", "Framework", "Total", "Memory", "Gzip"],
    rows.map((row, index) => [
      textCell(`#${index + 1}`, "rank-cell"),
      textCell(row.frameworkVersion, "framework-cell"),
      scoreCell(`${formatRatio(row.totalScore)}x`, row.totalScore / bestTotal),
      scoreCell(`${formatRatio(row.memoryScore)}x`, row.memoryScore / bestMemory),
      scoreCell(`${format(row.gzipKB)} KB`, row.gzipKB / bestSize),
    ]),
  );
}

function renderBenchmarkGroup(group) {
  const section = document.createElement("section");
  section.className = "rounded-lg border border-slate-200 bg-white p-4";

  const heading = document.createElement("h3");
  heading.className = "mb-3 text-lg font-semibold tracking-normal text-slate-900";
  heading.textContent = `${group[0].benchmark} · ${group[0].label}`;

  const table = renderTable(
    ["Framework", "Total", "Script", "Paint", "Memory", "Gzip"],
    group
      .toSorted((a, b) => a.total - b.total)
      .map((result) => [
        textCell(result.frameworkVersion, "framework-cell"),
        scoreCell(`${format(result.total)} ms · ${formatRatio(result.totalRatio)}x`, result.totalRatio),
        scoreCell(`${format(result.script)} ms · ${formatRatio(result.scriptRatio)}x`, result.scriptRatio),
        scoreCell(`${format(result.paint)} ms · ${formatRatio(result.paintRatio)}x`, result.paintRatio),
        scoreCell(`${format(result.memory)} MB · ${formatRatio(result.memoryRatio)}x`, result.memoryRatio),
        scoreCell(`${format(result.gzipKB)} KB · ${formatRatio(result.sizeRatio)}x`, result.sizeRatio),
      ]),
  );

  section.replaceChildren(heading, table);
  return section;
}

function renderTable(headers, rows) {
  const table = document.createElement("table");
  table.className = "w-full border-collapse bg-white text-sm text-slate-900";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.className = "border-b border-slate-200 text-left text-xs uppercase text-slate-500";
  for (const header of headers) {
    const cell = document.createElement("th");
    cell.className = header === "Framework" ? "px-3 py-2" : "px-3 py-2 text-right";
    cell.textContent = header;
    headRow.append(cell);
  }
  thead.append(headRow);

  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.className = "border-b border-slate-100 hover:bg-slate-50";
    for (const cell of row) tr.append(cell);
    tbody.append(tr);
  }

  table.replaceChildren(thead, tbody);
  return table;
}

function textCell(text, type) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.className =
    type === "rank-cell"
      ? "px-3 py-2 text-right font-semibold text-slate-900 tabular-nums"
      : "px-3 py-2 font-medium text-slate-900";
  cell.textContent = text;
  return cell;
}

function scoreCell(text, ratio) {
  const cell = document.createElement("td");
  cell.className = `px-3 py-2 text-right tabular-nums ${scoreClass(ratio)}`;
  cell.textContent = text;
  return cell;
}

function enrichResults(results) {
  const groups = groupByBenchmark(results);
  const enriched = [];
  for (const group of groups) {
    const bestTotal = minMetric(group, (result) => result.summary.total.median);
    const bestScript = minMetric(group, (result) => result.summary.script.median);
    const bestPaint = minMetric(group, (result) => result.summary.paint.median);
    const bestMemory = minMetric(group, (result) => result.summary.memoryMB.median);
    const bestSize = minMetric(group, (result) => result.size.gzipBytes / 1024);
    for (const result of group) {
      const total = result.summary.total.median;
      const script = result.summary.script.median;
      const paint = result.summary.paint.median;
      const memory = result.summary.memoryMB.median;
      const gzipKB = result.size.gzipBytes / 1024;
      enriched.push({
        ...result,
        total,
        script,
        paint,
        memory,
        gzipKB,
        totalRatio: ratio(total, bestTotal),
        scriptRatio: ratio(script, bestScript),
        paintRatio: ratio(paint, bestPaint),
        memoryRatio: ratio(memory, bestMemory),
        sizeRatio: ratio(gzipKB, bestSize),
      });
    }
  }
  return enriched;
}

function groupByBenchmark(results) {
  const groups = new Map();
  for (const result of results) {
    const group = groups.get(result.benchmark) ?? [];
    group.push(result);
    groups.set(result.benchmark, group);
  }
  return [...groups.values()];
}

function minMetric(rows, read) {
  return Math.min(...rows.map(read).filter((value) => typeof value === "number" && Number.isFinite(value) && value > 0));
}

function ratio(value, best) {
  if (typeof value !== "number" || !Number.isFinite(value) || typeof best !== "number" || !Number.isFinite(best) || best <= 0) return Infinity;
  return value / best;
}

function geometricMean(values) {
  const finite = values.filter((value) => Number.isFinite(value) && value > 0);
  if (finite.length === 0) return Infinity;
  return Math.exp(finite.reduce((sum, value) => sum + Math.log(value), 0) / finite.length);
}

function scoreClass(ratio) {
  if (ratio <= 1.01) return "score-best";
  if (ratio <= 1.15) return "score-good";
  if (ratio <= 1.5) return "score-mid";
  if (ratio <= 2.5) return "score-warn";
  return "score-bad";
}

function setView(view) {
  const showingResults = view === "results";
  appsPanel.hidden = showingResults;
  resultsPanel.hidden = !showingResults;
  status.textContent = showingResults ? "Latest benchmark results" : "Benchmark apps";
  history.replaceState(null, "", showingResults ? "/results" : "/");
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

function format(value) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "";
}

function formatRatio(value) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "";
}
