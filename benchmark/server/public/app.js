import { Async } from "/framework/browser.js";

const root = document.getElementById("benchmark-ui");
const status = document.getElementById("status");
const appsPanel = document.getElementById("apps-panel");
const resultsPanel = document.getElementById("results-panel");
const appsGrid = document.getElementById("apps-grid");
const resultsMeta = document.getElementById("results-meta");
const resultsBody = document.getElementById("results-body");

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
  resultsBody.replaceChildren(...results.results.map(renderResultRow));
}

function renderResultRow(result) {
  const row = document.createElement("tr");
  row.className = "border-b border-slate-100 hover:bg-slate-50";
  appendCell(row, result.frameworkVersion, "px-3 py-2 font-medium text-slate-900");
  appendCell(row, `${result.benchmark} · ${result.label}`, "px-3 py-2 text-slate-700");
  appendCell(row, format(result.summary.total.median), "px-3 py-2 text-right tabular-nums");
  appendCell(row, format(result.summary.script.median), "px-3 py-2 text-right tabular-nums");
  appendCell(row, format(result.summary.paint.median), "px-3 py-2 text-right tabular-nums");
  appendCell(row, format(result.summary.memoryMB.median), "px-3 py-2 text-right tabular-nums");
  appendCell(row, format(result.size.gzipBytes / 1024), "px-3 py-2 text-right tabular-nums");
  return row;
}

function appendCell(row, text, className) {
  const cell = document.createElement("td");
  cell.className = className;
  cell.textContent = text;
  row.append(cell);
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
