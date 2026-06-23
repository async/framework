import {
  createPartialRegistry,
  createRouteRegistry,
  createRouter,
  route
} from "./async-framework.js";
import { docsData } from "./docs-data.js";

const pages = new Map(docsData.pages.map((page) => [page.route, page]));
const pageById = new Map(docsData.pages.map((page) => [page.id, page]));
const defaultPage = pages.get(docsData.defaultRoute) ?? docsData.pages[0];
const fallbackPage = {
  id: "not-found",
  title: "Page not found",
  route: "*",
  group: "Reference",
  description: "The requested docs page does not exist.",
  markdown: "# Page not found\n\nChoose a page from the docs navigation.",
  html: "<h1>Page not found</h1><p>Choose a page from the docs navigation.</p>",
  toc: []
};

const partialEntries = Object.fromEntries(docsData.pages.map((page) => [
  page.id,
  () => renderArticle(page)
]));
partialEntries[fallbackPage.id] = () => renderArticle(fallbackPage);

const routeEntries = Object.fromEntries(docsData.pages.map((page) => [
  page.route,
  route(page.id)
]));
routeEntries["/"] = route(defaultPage.id);
routeEntries["*"] = route(fallbackPage.id);

const router = createRouter({
  mode: "csr",
  urlMode: "hash",
  root: document.body,
  boundary: "route",
  routes: createRouteRegistry(routeEntries),
  partials: createPartialRegistry(partialEntries)
}).start();

const searchInput = document.getElementById("docs-search");
const searchPanel = document.getElementById("search-panel");
const searchResults = document.getElementById("search-results");
const searchClose = document.getElementById("search-close");
const toc = document.getElementById("page-toc");
const copyMarkdown = document.getElementById("copy-markdown");

let currentPage = defaultPage;

router.signals.subscribe("router.path", (path) => {
  syncChrome(path);
});

syncChrome(router.signals.get("router.path") ?? docsData.defaultRoute);
setupSearch();
setupCopy();

function renderArticle(page) {
  return `
    <article class="doc-article">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="#${escapeHtml(docsData.defaultRoute)}">⌂</a>
        <span>›</span>
        <span>#${escapeHtml(page.route)}</span>
      </nav>
      ${page.html}
      <footer class="article-footer">
        <a href="#${escapeHtml(docsData.defaultRoute)}">Docs home</a>
        <a href="https://www.jsdocs.io/package/@async/framework" target="_blank" rel="noreferrer">API Reference</a>
      </footer>
    </article>
  `;
}

function syncChrome(path) {
  currentPage = pages.get(path) ?? (path === "/" ? defaultPage : fallbackPage);
  document.title = `${currentPage.title} · ${docsData.title}`;

  document.querySelectorAll("[data-route]").forEach((link) => {
    const active = link.getAttribute("data-route") === currentPage.route;
    link.toggleAttribute("aria-current", active);
  });

  renderToc(currentPage);
}

function renderToc(page) {
  if (!toc) return;
  toc.innerHTML = "";
  if (!page.toc.length) {
    const empty = document.createElement("span");
    empty.className = "toc-empty";
    empty.textContent = "No headings";
    toc.append(empty);
    return;
  }
  for (const item of page.toc) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `toc-link level-${item.level}`;
    button.textContent = item.title;
    button.addEventListener("click", () => {
      document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    toc.append(button);
  }
}

function setupSearch() {
  if (!searchInput || !searchPanel || !searchResults) return;

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearch();
    }
    if (event.key === "Escape") {
      closeSearch();
    }
  });

  searchInput.addEventListener("focus", openSearch);
  searchInput.addEventListener("input", () => renderSearch(searchInput.value));
  searchClose?.addEventListener("click", closeSearch);

  searchPanel.addEventListener("click", (event) => {
    const link = event.target.closest?.("a[href]");
    if (link) {
      closeSearch();
    }
  });
}

function openSearch() {
  searchPanel.hidden = false;
  searchInput?.focus();
  renderSearch(searchInput?.value ?? "");
}

function closeSearch() {
  if (searchPanel) {
    searchPanel.hidden = true;
  }
}

function renderSearch(query) {
  if (!searchResults) return;
  const value = query.trim().toLowerCase();
  const results = value
    ? docsData.search
        .filter((item) => `${item.title} ${item.group} ${item.description} ${item.text}`.toLowerCase().includes(value))
        .slice(0, 8)
    : docsData.search.slice(0, 6);

  searchResults.innerHTML = "";
  for (const item of results) {
    const link = document.createElement("a");
    link.href = `#${item.route}`;
    link.className = "search-result";
    link.innerHTML = `<strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.group)} · ${escapeHtml(item.description)}</span>`;
    searchResults.append(link);
  }
  if (!results.length) {
    const empty = document.createElement("p");
    empty.className = "search-empty";
    empty.textContent = "No matching docs pages.";
    searchResults.append(empty);
  }
}

function setupCopy() {
  copyMarkdown?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(currentPage.markdown);
      copyMarkdown.textContent = "Copied";
      window.setTimeout(() => {
        copyMarkdown.textContent = "Copy Markdown";
      }, 1600);
    } catch {
      copyMarkdown.textContent = "Copy unavailable";
      window.setTimeout(() => {
        copyMarkdown.textContent = "Copy Markdown";
      }, 1600);
    }
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
