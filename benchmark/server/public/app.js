import { Async } from "/framework/browser.js";

const root = document.getElementById("benchmark-ui");
const status = document.getElementById("status");
const appsPanel = document.getElementById("apps-panel");
const resultsPanel = document.getElementById("results-panel");
const appsGrid = document.getElementById("apps-grid");
const resultsMeta = document.getElementById("results-meta");
const resultsOverall = document.getElementById("results-overall");
const resultsGroups = document.getElementById("results-groups");
const frameworkFilterSummary = document.getElementById("framework-filter-summary");
const frameworkToggles = document.getElementById("framework-toggles");
const sizeUnitSelect = document.getElementById("size-unit");

const frameworkSelectionStorageKey = "async-framework-benchmark.visible-frameworks";
const sizeUnitStorageKey = "async-framework-benchmark.size-unit";
const sizeUnits = new Map([
  ["k", { label: "K", divisor: 1000 }],
  ["kb", { label: "KB", divisor: 1024 }],
  ["mb", { label: "MB", divisor: 1024 * 1024 }],
]);
let latestResults = null;
let selectedFrameworks = new Set();
let sizeUnit = loadSizeUnit();

Async.use({
  handler: {
    "view.apps": () => setView("apps"),
    "view.results": () => setView("results"),
    "filters.all": () => selectFrameworks(frameworkOptions(latestResults?.results ?? []).map((option) => option.framework)),
    "filters.asyncOnly": () => selectFrameworks(["async-framework", "js-only"]),
  },
});

Async.start({ root, router: false });
sizeUnitSelect.value = sizeUnit;
sizeUnitSelect.addEventListener("change", (event) => {
  if (!(event.target instanceof HTMLSelectElement)) return;
  if (!sizeUnits.has(event.target.value)) return;
  sizeUnit = event.target.value;
  localStorage.setItem(sizeUnitStorageKey, sizeUnit);
  renderResultsView();
});
frameworkToggles.addEventListener("change", (event) => {
  if (!(event.target instanceof HTMLInputElement) || event.target.type !== "checkbox") return;
  const framework = event.target.dataset.framework;
  if (!framework) return;
  if (event.target.checked) {
    selectedFrameworks.add(framework);
  } else {
    selectedFrameworks.delete(framework);
  }
  saveSelectedFrameworks();
  renderResultsView();
});

await Promise.all([renderApps(), renderResults()]);
setView(root.dataset.view === "results" ? "results" : "apps");

async function renderApps() {
  const frameworks = await fetchJson("/ls");
  appsGrid.replaceChildren(
    ...frameworks.map((framework) => {
      const link = document.createElement("a");
      link.className = "rounded border border-slate-200 bg-white px-4 py-2.5 text-sky-700 transition hover:text-sky-900";
      link.href = `/${framework.uri}/index.html`;
      link.textContent = displayFrameworkLabel(framework.directory, framework.frameworkVersionString);
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

  latestResults = results;
  selectedFrameworks = loadSelectedFrameworks(frameworkOptions(results.results));
  renderFrameworkToggles(results.results);
  renderResultsView();
}

function renderResultsView() {
  if (!latestResults) return;

  const options = frameworkOptions(latestResults.results);
  const visibleResults = latestResults.results.filter((result) => selectedFrameworks.has(result.framework));
  resultsMeta.textContent = `${latestResults.generatedAt} · ${latestResults.mode} · ${latestResults.browser} · ${visibleResults.length} of ${latestResults.results.length} rows`;
  frameworkFilterSummary.textContent = `${selectedFrameworks.size} of ${options.length} frameworks visible. Scores are recalculated against the visible set.`;
  syncFrameworkToggles();

  if (visibleResults.length === 0) {
    resultsOverall.replaceChildren(emptyMessage("Select at least one framework to compare."));
    resultsGroups.replaceChildren();
    return;
  }

  const enriched = enrichResults(visibleResults);
  resultsOverall.replaceChildren(renderOverallTable(enriched));
  resultsGroups.replaceChildren(...groupByBenchmark(enriched).map(renderBenchmarkGroup));
}

function renderFrameworkToggles(results) {
  frameworkToggles.replaceChildren(
    ...frameworkOptions(results).map((option) => {
      const label = document.createElement("label");
      label.className = "flex items-center gap-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.framework = option.framework;
      input.checked = selectedFrameworks.has(option.framework);

      const name = document.createElement("span");
      name.className = "font-medium text-slate-900";
      name.textContent = option.label;

      label.replaceChildren(input, name);
      return label;
    }),
  );
}

function frameworkOptions(results) {
  const frameworks = new Map();
  for (const result of results) {
    if (!frameworks.has(result.framework)) {
      frameworks.set(result.framework, {
        framework: result.framework,
        frameworkVersion: result.frameworkVersion,
        label: displayFrameworkLabel(result.framework, result.frameworkVersion),
      });
    }
  }
  return [...frameworks.values()];
}

function loadSelectedFrameworks(options) {
  const validFrameworks = new Set(options.map((option) => option.framework));
  try {
    const saved = JSON.parse(localStorage.getItem(frameworkSelectionStorageKey) ?? "[]");
    const selected = saved.filter((framework) => validFrameworks.has(framework));
    if (selected.length > 0) return new Set(selected);
  } catch {
    localStorage.removeItem(frameworkSelectionStorageKey);
  }
  return new Set(validFrameworks);
}

function selectFrameworks(frameworks) {
  const validFrameworks = new Set(frameworkOptions(latestResults?.results ?? []).map((option) => option.framework));
  selectedFrameworks = new Set(frameworks.filter((framework) => validFrameworks.has(framework)));
  saveSelectedFrameworks();
  renderResultsView();
}

function saveSelectedFrameworks() {
  localStorage.setItem(frameworkSelectionStorageKey, JSON.stringify([...selectedFrameworks]));
}

function syncFrameworkToggles() {
  for (const input of frameworkToggles.querySelectorAll("input[type='checkbox']")) {
    input.checked = selectedFrameworks.has(input.dataset.framework);
  }
}

function emptyMessage(text) {
  const message = document.createElement("p");
  message.className = "rounded border border-slate-200 bg-white p-4 text-sm text-slate-600";
  message.textContent = text;
  return message;
}

function renderOverallTable(results) {
  const frameworks = new Map();
  for (const result of results) {
    const current = frameworks.get(result.framework) ?? {
      frameworkLabel: result.frameworkLabel,
      framework: result.framework,
      totalRatios: [],
      memoryRatios: [],
      brBytes: result.brBytes,
    };
    current.totalRatios.push(result.totalRatio);
    current.memoryRatios.push(result.memoryRatio);
    current.brBytes = result.brBytes;
    frameworks.set(result.framework, current);
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
  const bestSize = Math.min(...rows.map((row) => row.brBytes));
  const sizeHeader = `BR (${currentSizeUnit().label})`;

  return renderTable(
    ["Rank", "Framework", "Total", "Memory", sizeHeader],
    rows.map((row, index) => [
      textCell(`#${index + 1}`, "rank-cell"),
      textCell(row.frameworkLabel, "framework-cell"),
      scoreCell(`${formatRatio(row.totalScore)}x`, row.totalScore / bestTotal),
      scoreCell(`${formatRatio(row.memoryScore)}x`, row.memoryScore / bestMemory),
      scoreCell(formatSize(row.brBytes), row.brBytes / bestSize),
    ]),
  );
}

function renderBenchmarkGroup(group) {
  const section = document.createElement("section");
  section.className = "rounded-lg border border-slate-200 bg-white p-4";

  const heading = document.createElement("h3");
  heading.className = "mb-3 text-lg font-semibold tracking-normal text-slate-900";
  heading.textContent = displayBenchmarkLabel(group[0]);
  const sizeHeader = `BR (${currentSizeUnit().label})`;

  const table = renderTable(
    ["Framework", "Total", "Script", "Paint", "Memory", sizeHeader],
    group
      .toSorted((a, b) => a.total - b.total)
      .map((result) => [
        textCell(result.frameworkLabel, "framework-cell"),
        scoreCell(`${format(result.total)} ms · ${formatRatio(result.totalRatio)}x`, result.totalRatio),
        scoreCell(`${format(result.script)} ms · ${formatRatio(result.scriptRatio)}x`, result.scriptRatio),
        scoreCell(`${format(result.paint)} ms · ${formatRatio(result.paintRatio)}x`, result.paintRatio),
        scoreCell(`${format(result.memory)} MB · ${formatRatio(result.memoryRatio)}x`, result.memoryRatio),
        scoreCell(`${formatSize(result.brBytes)} · ${formatRatio(result.sizeRatio)}x`, result.sizeRatio),
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
    const bestSize = minMetric(group, (result) => compressedBytes(result.size));
    for (const result of group) {
      const total = result.summary.total.median;
      const script = result.summary.script.median;
      const paint = result.summary.paint.median;
      const memory = result.summary.memoryMB.median;
      const brBytes = compressedBytes(result.size);
      enriched.push({
        ...result,
        frameworkLabel: displayFrameworkLabel(result.framework, result.frameworkVersion),
        total,
        script,
        paint,
        memory,
        brBytes,
        totalRatio: ratio(total, bestTotal),
        scriptRatio: ratio(script, bestScript),
        paintRatio: ratio(paint, bestPaint),
        memoryRatio: ratio(memory, bestMemory),
        sizeRatio: ratio(brBytes, bestSize),
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

function format(value, decimals = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(decimals) : "";
}

function formatRatio(value) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "";
}

function compressedBytes(size) {
  return size.brBytes;
}

function currentSizeUnit() {
  return sizeUnits.get(sizeUnit) ?? sizeUnits.get("kb");
}

function formatSize(bytes) {
  const unit = currentSizeUnit();
  const value = bytes / unit.divisor;
  const decimals = unit.label === "MB" && value < 1 ? 3 : 2;
  return `${format(value, decimals)} ${unit.label}`;
}

function loadSizeUnit() {
  const saved = localStorage.getItem(sizeUnitStorageKey);
  return sizeUnits.has(saved) ? saved : "kb";
}

function displayBenchmarkLabel(result) {
  return result.label || humanizeIdentifier(result.benchmark);
}

function displayFrameworkLabel(framework, frameworkVersion = "") {
  if (framework === "async-framework") return "@async/framework";
  if (framework === "js-only") return "JavaScript";
  if (framework === "react") return `React v${majorVersion(frameworkVersion) ?? "19"}`;
  if (framework === "solid-v1") return "Solid v1";
  if (framework === "solid-v2") return "Solid v2";
  if (framework === "qwik-v1") return "Qwik v1";
  if (framework === "qwik-v2") return "Qwik v2";
  return humanizeIdentifier(framework);
}

function majorVersion(value) {
  return value.match(/-v(\d+)/)?.[1];
}

function humanizeIdentifier(value) {
  return String(value)
    .replace(/^\d+_/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
