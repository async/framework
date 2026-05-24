import {
  Template,
  TemplateLoader,
  TemplateOptions,
  TemplateVersionError,
} from "./types.ts";

// Why: Provides a more robust template registry with versioning and preloading
class TemplateRegistry {
  private templates: Map<string, Template> = new Map();
  private loaders: Map<string, TemplateLoader> = new Map();
  private loading: Map<string, Promise<Template>> = new Map();

  // Register a template with content
  register(id: string, content: string, options: TemplateOptions = {}): void {
    const version = options.version ?? 1;

    // Version checking logic
    const existing = this.templates.get(id);
    if (existing && !options.force) {
      if (existing.version > version) {
        throw new TemplateVersionError(id, existing.version, version);
      }
      // Skip if same version
      if (existing.version === version) {
        console.debug(`Template "${id}" v${version} already registered`);
        return;
      }
    }

    const template: Template = {
      id,
      content,
      version,
      metadata: options.metadata,
    };

    this.templates.set(id, template);

    if (options.preload) {
      this.preloadTemplate(template);
    }

    console.debug(
      `Template "${id}" ${
        existing ? "updated to" : "registered at"
      } v${version}`,
    );
  }

  // Register a template loader for lazy loading
  registerLoader(id: string, loader: TemplateLoader): void {
    this.loaders.set(id, loader);
  }

  // Get template, optionally loading it if needed
  async getTemplate(id: string): Promise<Template | null> {
    // Return cached template if available
    if (this.templates.has(id)) {
      return this.templates.get(id) ?? null;
    }

    // Check if template is currently loading
    if (this.loading.has(id)) {
      return this.loading.get(id) ?? null;
    }

    // Try to load template if loader exists
    const loader = this.loaders.get(id);
    if (loader) {
      const loadingPromise = this.loadTemplate(id, loader);
      this.loading.set(id, loadingPromise);
      return loadingPromise;
    }

    return null;
  }

  // Get template synchronously (no loading)
  getTemplateSync(id: string): Template | null {
    return this.templates.get(id) ?? null;
  }

  private async loadTemplate(
    id: string,
    loader: TemplateLoader,
  ): Promise<Template> {
    try {
      const content = await loader();
      const template: Template = { id, content, version: 1 };
      this.templates.set(id, template);
      this.loading.delete(id);
      return template;
    } catch (error) {
      this.loading.delete(id);
      throw new Error(`Failed to load template ${id}: ${error.message}`);
    }
  }

  private preloadTemplate(template: Template): void {
    // Parse and cache the template content
    const templateElement = document.createElement("template");
    templateElement.innerHTML = template.content;
    // Could add additional preprocessing here
  }

  // Clear all templates
  clear(): void {
    this.templates.clear();
    this.loaders.clear();
    this.loading.clear();
  }

  // Get specific version of template
  async getTemplateVersion(
    id: string,
    version: number,
  ): Promise<Template | null> {
    const template = await this.getTemplate(id);
    if (template && template.version === version) {
      return template;
    }
    return null;
  }
}

// Export singleton instance
export const templateRegistry = new TemplateRegistry();

// Export convenience methods
export const registerTemplate = (
  id: string,
  content: string,
  options?: TemplateOptions,
): void => templateRegistry.register(id, content, options);

export const getTemplate = (id: string): Promise<Template | null> =>
  templateRegistry.getTemplate(id);

export const getTemplateSync = (id: string): Template | null =>
  templateRegistry.getTemplateSync(id);
