export function buildFrameworkVersionString(directoryName: string, version: string) {
  return `${directoryName}${version ? `-v${version}` : ""}`;
}
