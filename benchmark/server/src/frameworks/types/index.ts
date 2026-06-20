export interface BenchmarkData {
  issues: string;
  customURL: string;
  frameworkHomeURL: string;
  language: string;
  useShadowRoot: string;
  useRowShadowRoot: string;
  shadowRootName?: string;
  buttonsInShadowRoot?: string | boolean;
  frameworkVersionFromPackage?: string;
  frameworkVersionFromRootPackage?: string;
  frameworkVersion?: string;
  startLogicEventName?: string;
  sizeRoot?: string;
}

export interface Result {
  type: "app";
  directory: string;
  error?: string;
  version?: string;
  versions?: Record<string, string>;
  frameworkVersionString?: string;
  customURL?: string;
  sizeRoot?: string;
  useShadowRoot?: string;
  uri?: string;
}
