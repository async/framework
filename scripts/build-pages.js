#!/usr/bin/env node
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const site = {
  title: "@async/framework",
  repo: "framework",
  stage: "Layer 1",
  description: "No-build AsyncLoader runtime with signals, async signals, delegated handlers, scoped fragments, and streaming boundaries.",
  lead: "Plain HTML plus ESM for reactive islands, async loading state, and out-of-order HTML swaps without a virtual DOM.",
  quickstart: "pnpm add @async/framework\n\nimport { AsyncLoader, createSignalRegistry, signal } from '@async/framework';\n\nconst signals = createSignalRegistry({ count: signal(0) });\nAsyncLoader({ root: document, signals }).start();"
};

const outDir = ".async/pages";
const asyncProjects = [
  ["@async/db", "https://async.github.io/db/", "Data workflow"],
  ["@async/json", "https://async.github.io/json/", "JSON database engine"],
  ["@async/web", "https://async.github.io/web/", "Web runtime"],
  ["@async/framework", "https://async.github.io/framework/", "AsyncLoader runtime"],
  ["@async/pipeline", "https://async.github.io/pipeline/", "Pipeline workflows"],
  ["@async/dispatch", "https://async.github.io/dispatch/", "Goal-first coordination"],
  ["@async/auto-git", "https://async.github.io/auto-git/", "Git handoffs"],
  ["@async/api-contract", "https://async.github.io/api-contract/", "API ledgers"],
  ["@async/claims", "https://async.github.io/claims/", "Doc claim checks"]
];

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const readme = await readFile("README.md", "utf8");
const changelog = await readFile("CHANGELOG.md", "utf8");

await writeFile(join(outDir, "index.html"), layout({
  title: site.title,
  body: home(readme),
  rootPrefix: ""
}));

await writeFile(join(outDir, "changelog.html"), layout({
  title: `${site.title} Changelog`,
  body: `<div class="markdown">${renderMarkdown(changelog)}</div>`,
  rootPrefix: ""
}));

function home(readme) {
  const related = asyncProjects
    .filter(([name]) => name !== site.title)
    .map(([name, url, label]) => `<a class="related" href="${url}"><strong>${name}</strong><span>${label}</span></a>`)
    .join("\n");
  return `
    <section class="hero">
      <p class="eyebrow">${escapeHtml(site.stage)} / Async</p>
      <h1>${escapeHtml(site.title)}</h1>
      <p class="lead">${renderInline(site.description)}</p>
      <p class="sublead">${renderInline(site.lead)}</p>
      <div class="actions">
        <a class="primary-link" href="https://github.com/async/${site.repo}">GitHub</a>
        <a href="https://www.npmjs.com/package/${encodeURIComponent(site.title)}">npm</a>
        <a href="changelog.html">Changelog</a>
      </div>
    </section>
    <section>
      <h2>Start</h2>
      <pre><code>${escapeHtml(site.quickstart)}</code></pre>
    </section>
    <section>
      <h2>Related Async Projects</h2>
      <div class="related-grid">${related}</div>
    </section>
    <section>
      <h2>README</h2>
      <div class="markdown">${renderMarkdown(readme)}</div>
    </section>
  `;
}

function layout({ title, body, rootPrefix }) {
  const nav = asyncProjects.map(([name, url]) =>
    `<a href="${url}"${name === site.title ? " aria-current=\"page\"" : ""}>${name.replace("@async/", "")}</a>`
  ).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(site.description)}">
  <style>
    :root{color-scheme:dark;--bg:#15202b;--soft:#192734;--raised:#1f2f3d;--border:#38444d;--border2:#2f3c47;--text:#f7f9f9;--muted:#8b98a5;--body:#cfd9de;--blue:#1d9bf0;--green:#00ba7c;--code:#0f1720;--shadow:0 24px 80px rgba(2,6,23,.32)}
    *{box-sizing:border-box}html{min-height:100%;background:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(180deg,#15202b 0%,#111923 100%);background-size:40px 40px,40px 40px,auto}body{margin:0;color:var(--body);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.65}a{color:var(--blue);text-decoration:none}a:hover{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px}.container{width:min(100% - 32px,1080px);margin:48px auto 72px}.page{overflow:hidden;background:rgba(25,39,52,.94);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow)}.topbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;padding:16px clamp(24px,4vw,56px);background:rgba(15,23,32,.72);border-bottom:1px solid var(--border)}.brand{display:inline-flex;align-items:center;gap:10px;color:var(--text);font-weight:850}.mark{display:grid;width:26px;height:26px;grid-template-columns:repeat(2,1fr);gap:4px}.mark span{border:1px solid var(--blue);border-radius:3px}.mark span:nth-child(2){border-color:var(--green)}.mark span:nth-child(3){border-color:#facc15}.mark span:nth-child(4){border-color:#7dd3fc}.nav{display:flex;flex-wrap:wrap;gap:14px;font-size:.92rem;font-weight:750}.nav a{color:var(--muted)}.nav a[aria-current=page]{color:var(--text)}main{padding:clamp(24px,4vw,56px)}.eyebrow{margin:0 0 12px;color:var(--blue);font-size:.78rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase}h1,h2,h3{color:var(--text);line-height:1.2;letter-spacing:0}h1{max-width:860px;margin:0 0 16px;font-size:clamp(2.25rem,5vw,4.5rem);font-weight:850}h2{margin:48px 0 16px;padding-top:28px;border-top:1px solid var(--border);font-size:clamp(1.45rem,3vw,2rem)}h3{margin:28px 0 10px;font-size:1.14rem}.lead{max-width:860px;color:var(--text);font-size:clamp(1.18rem,2.4vw,1.45rem);line-height:1.45}.sublead{max-width:860px;color:var(--muted);font-size:1.05rem}.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}.actions a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 16px;color:var(--text);font-weight:800;background:rgba(15,23,32,.54);border:1px solid var(--border);border-radius:10px}.actions .primary-link{color:#06101f;background:var(--blue);border-color:var(--blue)}.related-grid{display:grid;gap:12px;margin-top:18px}@media (min-width:760px){.related-grid{grid-template-columns:repeat(2,1fr)}}.related{display:block;padding:16px 18px;background:rgba(15,23,32,.48);border:1px solid var(--border2);border-radius:12px}.related strong{display:block;color:var(--text);font-weight:800}.related span{display:block;margin-top:4px;color:var(--muted)}pre{overflow-x:auto;margin:1rem 0 1.5rem;padding:18px 20px;color:var(--body);background:linear-gradient(180deg,#101923 0%,#0d141d 100%);border:1px solid var(--border2);border-radius:12px}code{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;font-size:.92em}p code,li code{padding:.1rem .35rem;color:var(--text);background:rgba(15,23,32,.65);border:1px solid var(--border2);border-radius:6px}.markdown p{max-width:860px}.markdown table{display:block;max-width:100%;overflow:auto;border-collapse:collapse}.markdown th,.markdown td{padding:8px 10px;border:1px solid var(--border2)}.markdown blockquote{margin:18px 0;padding:2px 0 2px 18px;color:var(--muted);border-left:3px solid var(--blue)}footer{padding:20px clamp(24px,4vw,56px);color:var(--muted);border-top:1px solid var(--border)}
  </style>
</head>
<body>
  <div class="container"><div class="page"><header class="topbar"><a class="brand" href="${rootPrefix}index.html"><span class="mark"><span></span><span></span><span></span><span></span></span><span>${escapeHtml(site.title)}</span></a><nav class="nav">${nav}</nav></header><main>${body}</main><footer>Built by <code>pnpm run pipeline:pages</code>. Workflow source: <code>pipeline.ts</code>.</footer></div></div>
</body>
</html>
`;
}

function renderMarkdown(source) {
  const lines = normalizeMarkdownLines(source);
  const html = [];
  let list = "";
  let code = null;
  let table = [];
  const closeList = () => { if (list) { html.push(`</${list}>`); list = ""; } };
  const closeTable = () => { if (table.length) { html.push(renderTable(table)); table = []; } };
  for (const line of lines) {
    if (line.startsWith("```")) {
      closeList(); closeTable();
      if (code) { html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`); code = null; } else { code = []; }
      continue;
    }
    if (code) { code.push(line); continue; }
    if (line.startsWith("|")) { closeList(); table.push(line); continue; }
    closeTable();
    if (/^###\s+/.test(line)) { closeList(); html.push(`<h3 id="${slug(line.slice(4))}">${renderInline(line.slice(4))}</h3>`); continue; }
    if (/^##\s+/.test(line)) { closeList(); html.push(`<h2 id="${slug(line.slice(3))}">${renderInline(line.slice(3))}</h2>`); continue; }
    if (/^#\s+/.test(line)) { closeList(); html.push(`<h2 id="${slug(line.slice(2))}">${renderInline(line.slice(2))}</h2>`); continue; }
    if (/^-\s+/.test(line)) { if (list !== "ul") { closeList(); list = "ul"; html.push("<ul>"); } html.push(`<li>${renderInline(line.slice(2))}</li>`); continue; }
    if (/^\d+\.\s+/.test(line)) { if (list !== "ol") { closeList(); list = "ol"; html.push("<ol>"); } html.push(`<li>${renderInline(line.replace(/^\d+\.\s+/, ""))}</li>`); continue; }
    if (/^>\s?/.test(line)) { closeList(); html.push(`<blockquote>${renderInline(line.replace(/^>\s?/, ""))}</blockquote>`); continue; }
    if (!line.trim()) { closeList(); continue; }
    closeList(); html.push(`<p>${renderInline(line.trim())}</p>`);
  }
  closeList(); closeTable();
  return html.join("\n");
}

function normalizeMarkdownLines(source) {
  const lines = [];
  let inCode = false;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (line.startsWith("```")) {
      lines.push(line);
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      lines.push(rawLine);
      continue;
    }
    if (!line.trim()) {
      lines.push("");
      continue;
    }

    const previous = lines.at(-1);
    if (shouldJoin(previous, line)) {
      lines[lines.length - 1] = `${previous} ${line.trim()}`;
      continue;
    }

    lines.push(line);
  }

  return lines;
}

function shouldJoin(previous, line) {
  if (!previous || !previous.trim()) return false;
  if (isBlockStart(line)) return false;
  if (previous.trim().startsWith("|")) return false;
  if (previous.trim().startsWith(">")) return false;
  if (/^#{1,6}\s+/.test(previous.trim())) return false;
  return true;
}

function isBlockStart(line) {
  return /^(```|#{1,6}\s+|- |\d+\. |>|\|)/.test(line.trim());
}

function renderTable(lines) {
  const rows = lines.map((line) => line.trim().slice(1, -1).split("|").map((cell) => cell.trim()));
  const body = rows.filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell))).map((row, index) => {
    const tag = index === 0 ? "th" : "td";
    return `<tr>${row.map((cell) => `<${tag}>${renderInline(cell)}</${tag}>`).join("")}</tr>`;
  }).join("\n");
  return `<table>${body}</table>`;
}

function renderInline(value) {
  return String(value).split(/(`[^`]+`)/g).map((segment) => {
    if (segment.startsWith("`") && segment.endsWith("`")) {
      return `<code>${escapeHtml(segment.slice(1, -1))}</code>`;
    }
    return renderTextLinks(segment);
  }).join("");
}

function renderTextLinks(value) {
  return String(value).split(/(\[[^\]]+\]\([^)]+\))/g).map((segment) => {
    const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(segment);
    if (match) return `<a href="${escapeHtml(match[2])}">${escapeHtml(match[1])}</a>`;
    let html = escapeHtml(segment);
    for (const [name, url] of asyncProjects) {
      if (name === site.title) continue;
      html = html.replace(new RegExp(escapeRegExp(name), "g"), `<a href="${url}">${name}</a>`);
    }
    return html;
  }).join("");
}

function slug(value) {
  return String(value).toLowerCase().replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
