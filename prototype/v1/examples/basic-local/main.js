import { createAsyncFramework, effect } from "../../index.ts";
import { logAfter, onClick } from "./handlers.js";
import { count } from "./signals.js";

const app = document.querySelector("#app");
const framework = createAsyncFramework({ root: app });

framework.handlers.registerHandlers({
  "local/click": onClick,
  "local/log": logAfter,
});

framework.start();

effect(() => {
  const button = app.querySelector("button");
  if (!button) return;
  button.setAttribute("data-count", String(count.value));
  button.textContent = `Clicked ${count.value} times`;
});
