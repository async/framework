import { isSignalRef } from "./signals.js";
import { attributeName, matchAttribute, normalizeAttributeConfig } from "./attributes.js";

const templateKind = Symbol.for("@async/framework.template");
const rawKind = Symbol.for("@async/framework.rawHtml");
const childrenKind = Symbol.for("@async/framework.children");

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

export function childrenFragment(source) {
  if (isChildrenFragment(source)) {
    return source;
  }
  let consumed = false;
  const fragment = {
    [childrenKind]: true,
    consume(context = createRenderContext()) {
      if (consumed) {
        throw new Error("Async children fragments can only be consumed once.");
      }
      consumed = true;
      const value = typeof source === "function"
        ? source.call(context.fragmentContext ?? undefined)
        : source;
      return renderTemplate(value, context);
    }
  };
  return Object.freeze(fragment);
}

export function isChildrenFragment(value) {
  return Boolean(value?.[childrenKind]);
}

export function renderTemplate(value, options = {}) {
  if (isTemplateResult(value)) {
    const context = createRenderContext(options);
    let output = "";
    for (let index = 0; index < value.strings.length; index += 1) {
      output += value.strings[index];
      if (index < value.values.length) {
        output += renderValue(value.values[index], {
          ...context,
          attribute: readAttributeContext(value.strings[index])
        });
      }
    }
    return output;
  }
  return renderValue(value, createRenderContext(options));
}

function renderValue(value, context = createRenderContext()) {
  if (isChildrenFragment(value)) {
    return value.consume(context);
  }
  if (value?.[rawKind]) {
    return value.html;
  }
  if (isTemplateResult(value)) {
    return renderTemplate(value, context);
  }
  if (context.attribute) {
    return renderAttributeValue(value, context);
  }
  if (Array.isArray(value)) {
    return value.map((item) => renderValue(item, context)).join("");
  }
  if (isSignalRef(value)) {
    return escapeHtml(value.value);
  }
  if (value == null || value === false) {
    return "";
  }
  return escapeHtml(value);
}

function renderAttributeValue(value, context) {
  const signalName = matchAttribute(context.attribute.name, context.attributes, "signal");
  const className = matchAttribute(context.attribute.name, context.attributes, "class");
  const signalPath = signalPathFor(value, context);

  if (context.attribute.name === "value" && signalPath) {
    const currentValue = readSignalValue(value, context);
    const signalValueAttribute = attributeName(context.attributes, "signal", "value");
    return `${escapeHtml(currentValue)}${context.attribute.quote} ${signalValueAttribute}=${context.attribute.quote}${escapeHtml(signalPath)}`;
  }

  if (signalName != null || className != null) {
    if (signalPath) {
      return escapeHtml(signalPath);
    }
    if (isInlineBindingValue(value)) {
      return escapeHtml(registerInlineBinding(value, context));
    }
  }

  return renderValueAsAttributeLiteral(value, context);
}

function renderValueAsAttributeLiteral(value, context) {
  if (Array.isArray(value)) {
    return value.map((item) => renderValueAsAttributeLiteral(item, context)).join("");
  }
  if (isSignalRef(value)) {
    return escapeHtml(value.value);
  }
  if (value == null || value === false) {
    return "";
  }
  return escapeHtml(value);
}

function createRenderContext(options = {}) {
  return {
    ...options,
    attributes: normalizeAttributeConfig(options.attributes)
  };
}

function readAttributeContext(source) {
  const match = source.match(/(?:^|[\s<])([^\s"'=<>`]+)\s*=\s*(["'])$/);
  if (!match) {
    return null;
  }
  return {
    name: match[1],
    quote: match[2]
  };
}

function signalPathFor(value, context) {
  if (isSignalRef(value)) {
    return value.id;
  }
  if (typeof value === "string" && context.signals?.has?.(value)) {
    return value;
  }
  return null;
}

function readSignalValue(value, context) {
  if (isSignalRef(value)) {
    return value.value;
  }
  if (typeof value === "string" && context.signals?.has?.(value)) {
    return context.signals.get(value);
  }
  return value;
}

function isInlineBindingValue(value) {
  return Boolean(value && typeof value === "object");
}

function registerInlineBinding(value, context) {
  if (typeof context.bind !== "function") {
    return value;
  }
  return context.bind(value);
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
