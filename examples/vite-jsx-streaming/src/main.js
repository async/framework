import {
  plan,
  report,
  startAsyncFramework
} from "./Dashboard.jsx";

const controller = startAsyncFramework(document);
const reportNode = document.querySelector("[data-async-id='optimizer-report']");

if (reportNode) {
  reportNode.textContent = JSON.stringify({
    runtime: report.runtime.slices.map((slice) => slice.name),
    stream: report.stream,
    virtualModules: report.virtualModules
  }, null, 2);
}

globalThis.asyncFrameworkViteJsxStreaming = {
  controller,
  plan,
  report
};
