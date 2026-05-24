import { Signal, signal } from "@async/framework-v0";
export type Resource = {
  id: string;
  name: string;
  type: "server" | "database" | "storage";
  status: "active" | "inactive" | "error";
  usage: number;
  lastUpdated: string;
};

export const createMockResources = (
  amount = Math.round(Math.random() * 20),
): Resource[] =>
  Array.from({ length: amount }, (_, i) => ({
    id: `res-${i + 1}`,
    name: `Resource ${i + 1}`,
    type: [
      "server",
      "database",
      "storage",
    ][Math.floor(Math.random() * 3)] as Resource["type"],
    status: [
      "active",
      "inactive",
      "error",
    ][Math.floor(Math.random() * 3)] as Resource["status"],
    usage: Math.floor(Math.random() * 100),
    lastUpdated: new Date(Date.now() - Math.random() * 10000000000)
      .toISOString(),
  }));

let resources = createMockResources();
if (resources.length === 0) {
  resources = createMockResources();
}
const mockResources = signal(resources);
export function getResources(): Promise<Signal<Resource[]>> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockResources), 500);
  });
}

export function getResourceById(id: string): Promise<Resource | undefined> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (mockResources.value) {
        resolve(mockResources.value.find((r) => r.id === id));
      } else {
        resolve(undefined);
      }
    }, 300);
  });
}

// Update mock resources every 5 seconds
// setInterval(() => {
//   const resources = createMockResources();
//   console.log("MOCK: updating mock resources", resources.length);
//   mockResources.value = resources;
// }, 5000);
