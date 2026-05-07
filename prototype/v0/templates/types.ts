// Define clear types for template system
export interface Template {
  id: string;
  content: string;
  version: number;
  metadata?: Record<string, unknown>;
}

export interface TemplateOptions {
  version?: number;
  preload?: boolean;
  metadata?: Record<string, unknown>;
  force?: boolean;
}

export type TemplateLoader = () => Promise<string>;

// Add error type for version conflicts
export class TemplateVersionError extends Error {
  constructor(
    public templateId: string,
    public existingVersion: number,
    public newVersion: number,
  ) {
    super(
      `Template version conflict for "${templateId}": ` +
        `Cannot downgrade from v${existingVersion} to v${newVersion}`,
    );
  }
}
