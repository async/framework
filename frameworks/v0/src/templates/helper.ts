import { getTemplate, getTemplateSync } from "./registry.ts";

// Why: Provides enhanced template resolution with better error handling
export async function resolveTemplate(
  element: HTMLElement,
  templateId: string | null,
  componentName: string,
): Promise<string | null> {
  try {
    // Try sync template first
    if (templateId) {
      const template = getTemplateSync(templateId);
      if (template) {
        return template.content;
      }

      // Try async template
      const asyncTemplate = await getTemplate(templateId);
      if (asyncTemplate) {
        return asyncTemplate.content;
      }
    }

    // Fallback to inline template
    const inlineTemplate = element.querySelector("template");
    if (inlineTemplate) {
      const content = inlineTemplate.innerHTML;
      inlineTemplate.remove();
      return content;
    }

    // Fallback to innerHTML
    const innerHTML = element.innerHTML.trim();
    if (innerHTML) {
      return innerHTML;
    }

    console.warn(
      `${componentName}: No template found for ${
        templateId ?? "inline template"
      }`,
    );
    return null;
  } catch (error) {
    console.error(`Error resolving template for ${componentName}:`, error);
    return null;
  }
}
