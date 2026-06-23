#!/usr/bin/env node
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, normalize } from "node:path";

const root = process.cwd();
const docsDir = join(root, "docs");
const outDir = join(root, ".async/pages");
const assetsDir = join(outDir, "assets");
const navPath = join(docsDir, "nav.json");

const nav = JSON.parse(await readFile(navPath, "utf8"));
const pages = [];
const seenRoutes = new Set();

for (const group of nav.sidebar ?? []) {
  for (const page of group.pages ?? []) {
    pages.push(await readPage({ ...page, group: group.title }));
  }
}

for (const page of nav.extraPages ?? []) {
  pages.push(await readPage(page));
}

if (pages.length === 0) {
  throw new Error("docs/nav.json must define at least one page.");
}

const defaultRoute = nav.defaultRoute ?? pages[0].route;
const search = pages.map((page) => ({
  title: page.title,
  route: page.route,
  group: page.group,
  description: page.description,
  text: page.searchText
}));

await rm(outDir, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });

await copyFile(join(root, "dist/browser.js"), join(assetsDir, "async-framework.js"));
await copyFile(join(docsDir, "assets/app.js"), join(assetsDir, "app.js"));
await copyFile(join(docsDir, "assets/styles.css"), join(assetsDir, "styles.css"));

await writeFile(join(assetsDir, "docs-data.js"), `export const docsData = ${JSON.stringify({
  title: nav.title,
  description: nav.description,
  defaultRoute,
  topNav: nav.topNav ?? [],
  sidebar: nav.sidebar ?? [],
  pages,
  search
}, null, 2)};\n`, "utf8");

await writeFile(join(outDir, "index.html"), layout(nav), "utf8");

function layout(site) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(site.title)}</title>
  <meta name="description" content="${escapeHtml(site.description)}">
  <link rel="icon" href="data:image/svg+xml,%3Csvg viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230f172a'/%3E%3Cpath d='M9 16h14M16 9v14' stroke='%23ffffff' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E">
  <link rel="stylesheet" href="./assets/styles.css">
</head>
<body>
  <div class="docs-shell" async:container>
    <header class="topbar">
      <a class="brand" href="#${escapeHtml(defaultRoute)}" aria-label="${escapeHtml(site.title)} home">
        <span class="brand-mark" aria-hidden="true"></span>
        <span>${escapeHtml(site.title)}</span>
      </a>
      <nav class="topnav" aria-label="Primary navigation">
        ${(site.topNav ?? []).map(renderTopNavItem).join("\n        ")}
      </nav>
      <label class="search-control" aria-label="Search docs">
        <span aria-hidden="true">⌕</span>
        <input id="docs-search" type="search" autocomplete="off" placeholder="Search docs">
        <kbd>⌘ K</kbd>
      </label>
    </header>
    <aside class="sidebar" aria-label="Documentation navigation">
      ${renderSidebar(site.sidebar ?? [])}
    </aside>
    <main id="doc-content" class="content" async:boundary="route"></main>
    <aside class="toc" aria-label="On this page">
      <div class="toc-inner">
        <p>On this page</p>
        <nav id="page-toc"></nav>
        <button id="copy-markdown" class="copy-markdown" type="button">Copy Markdown</button>
      </div>
    </aside>
    <div id="search-panel" class="search-panel" hidden>
      <div class="search-panel-header">
        <strong>Search docs</strong>
        <button id="search-close" type="button" aria-label="Close search">×</button>
      </div>
      <div id="search-results" class="search-results"></div>
    </div>
  </div>
  <script type="module" src="./assets/app.js"></script>
</body>
</html>
`;
}

function renderTopNavItem(item) {
  const attrs = item.external ? ` target="_blank" rel="noreferrer"` : "";
  return `<a href="${escapeHtml(item.href)}"${attrs}>${escapeHtml(item.label)}</a>`;
}

function renderSidebar(groups) {
  return groups.map((group) => `
    <section class="sidebar-group">
      <h2>${escapeHtml(group.title)}</h2>
      <ul>
        ${(group.pages ?? []).map((page) => `<li><a data-route="${escapeHtml(page.route)}" href="#${escapeHtml(page.route)}">${escapeHtml(page.title)}</a></li>`).join("\n        ")}
      </ul>
    </section>
  `).join("\n");
}

async function readPage(page) {
  if (!page.route?.startsWith("/")) {
    throw new Error(`Docs page "${page.title}" must use an absolute route.`);
  }
  if (seenRoutes.has(page.route)) {
    throw new Error(`Duplicate docs route: ${page.route}`);
  }
  seenRoutes.add(page.route);

  const sourcePath = resolveDocSource(page.source);
  const markdown = await readFile(sourcePath, "utf8");
  const rendered = renderMarkdown(markdown);
  return {
    id: page.id ?? routeId(page.route),
    title: page.title,
    group: page.group ?? "",
    route: page.route,
    source: normalize(page.source),
    description: page.description ?? rendered.description,
    markdown,
    html: rendered.html,
    toc: rendered.toc,
    searchText: rendered.searchText
  };
}

function resolveDocSource(source) {
  if (!source || typeof source !== "string") {
    throw new Error("Docs page source must be a string.");
  }
  return normalize(join(docsDir, source));
}

function renderMarkdown(source) {
  const lines = normalizeMarkdownLines(source);
  const html = [];
  const toc = [];
  const textParts = [];
  let list = "";
  let code = null;
  let table = [];
  let description = "";

  const closeList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = "";
    }
  };
  const closeTable = () => {
    if (table.length) {
      html.push(renderTable(table));
      table = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      closeList();
      closeTable();
      if (code) {
        html.push(`<pre><code>${escapeHtml(code.lines.join("\n"))}</code></pre>`);
        code = null;
      } else {
        code = { lines: [], language: line.slice(3).trim() };
      }
      continue;
    }

    if (code) {
      code.lines.push(line);
      continue;
    }

    if (line.startsWith("|")) {
      closeList();
      table.push(line);
      continue;
    }
    closeTable();

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const label = stripInline(heading[2]);
      const id = slug(label);
      html.push(`<h${level} id="${id}">${renderInline(heading[2])}</h${level}>`);
      textParts.push(label);
      if (level === 2 || level === 3) {
        toc.push({ id, title: label, level });
      }
      continue;
    }

    if (/^-\s+/.test(line)) {
      if (list !== "ul") {
        closeList();
        list = "ul";
        html.push("<ul>");
      }
      const value = line.slice(2);
      html.push(`<li>${renderInline(value)}</li>`);
      textParts.push(stripInline(value));
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      if (list !== "ol") {
        closeList();
        list = "ol";
        html.push("<ol>");
      }
      const value = line.replace(/^\d+\.\s+/, "");
      html.push(`<li>${renderInline(value)}</li>`);
      textParts.push(stripInline(value));
      continue;
    }

    if (/^>\s?/.test(line)) {
      closeList();
      const value = line.replace(/^>\s?/, "");
      html.push(`<blockquote>${renderInline(value)}</blockquote>`);
      textParts.push(stripInline(value));
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    closeList();
    const value = line.trim();
    html.push(`<p>${renderInline(value)}</p>`);
    const plain = stripInline(value);
    textParts.push(plain);
    if (!description) {
      description = plain;
    }
  }

  closeList();
  closeTable();

  return {
    html: html.join("\n"),
    toc,
    description,
    searchText: textParts.join(" ").replace(/\s+/g, " ").trim()
  };
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
  const body = rows
    .filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell)))
    .map((row, index) => {
      const tag = index === 0 ? "th" : "td";
      return `<tr>${row.map((cell) => `<${tag}>${renderInline(cell)}</${tag}>`).join("")}</tr>`;
    })
    .join("\n");
  return `<table>${body}</table>`;
}

function renderInline(value) {
  return String(value).split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((segment) => {
    if (segment.startsWith("`") && segment.endsWith("`")) {
      return `<code>${escapeHtml(segment.slice(1, -1))}</code>`;
    }
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return `<strong>${escapeHtml(segment.slice(2, -2))}</strong>`;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(segment);
    if (link) {
      const href = link[2];
      const attrs = /^https?:\/\//.test(href) ? ` target="_blank" rel="noreferrer"` : "";
      return `<a href="${escapeHtml(href)}"${attrs}>${escapeHtml(link[1])}</a>`;
    }
    return escapeHtml(segment);
  }).join("");
}

function stripInline(value) {
  return String(value)
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function routeId(route) {
  return route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, ".").replace(/^\.+|\.+$/g, "") || "home";
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
