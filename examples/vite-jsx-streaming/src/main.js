// Dashboard.jsx is replaced at build time by @async/framework/vite with a
// generated bootstrap module, so { plan, report, startAsyncFramework } come
// from the plugin, not from the authored JSX exports.
import {
  plan,
  report,
  startAsyncFramework
} from "./Dashboard.jsx";

const controller = startAsyncFramework(document);
const reportNode = document.querySelector("[data-async-id='optimizer-report']");

if (reportNode) {
  reportNode.textContent = JSON.stringify({
    runtime: report.runtime.slices.map((slice) => `${slice.name} (${slice.status})`),
    stream: report.stream,
    virtualModules: report.virtualModules
  }, null, 2);
}

globalThis.asyncFrameworkViteJsxStreaming = {
  controller,
  plan,
  report
};
