import { isSignalRef } from "./signals.js";

const templateKind = Symbol.for("@async/framework.template");
const rawKind = Symbol.for("@async/framework.rawHtml");

export function html(strings, ...values) {
  return {
    [templateKind]: true,
    strings,
    values
  };
}

export function isTemplateResult(value) {
  return Boolean(value?.[templateKind]);
}

export function rawHtml(value) {
  return {
    [rawKind]: true,
    html: String(value ?? "")
  };
}

export function renderTemplate(value) {
  if (isTemplateResult(value)) {
    let output = "";
    for (let index = 0; index < value.strings.length; index += 1) {
      output += value.strings[index];
      if (index < value.values.length) {
        output += renderValue(value.values[index]);
      }
    }
    return output;
  }
  return renderValue(value);
}

function renderValue(value) {
  if (value?.[rawKind]) {
    return value.html;
  }
  if (isTemplateResult(value)) {
    return renderTemplate(value);
  }
  if (Array.isArray(value)) {
    return value.map(renderValue).join("");
  }
  if (isSignalRef(value)) {
    return escapeHtml(value.value);
  }
  if (value == null || value === false) {
    return "";
  }
  return escapeHtml(value);
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
