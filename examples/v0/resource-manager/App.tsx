import { createRouter, Signal, signal } from "@async/framework-v0";
import { ResourceList } from "./components/ResourceList.tsx";
import { ResourceDetails } from "./components/ResourceDetails.tsx";
import { Dashboard } from "./components/Dashboard.tsx";
import { Navigation } from "./components/Navigation.tsx";

export function App({ router }: { router: ReturnType<typeof createRouter> }) {
  const currentView = signal<
    | ReturnType<typeof Dashboard>
    | ReturnType<typeof ResourceList>
    | ReturnType<typeof ResourceDetails>
    | Signal<any>
    | null
  >(null);

  // Simple router logic
  router.current.subscribe(({ path, params: _params }) => {
    console.log("App.router.current", path);
    if (path === "/" || path === "/resources/") {
      const resourceList = <ResourceList router={router} />;
      currentView.value = resourceList;
    } else if (path.startsWith("/resources/")) {
      const id = path.split("/")[2];
      // @ts-ignore: JSX types
      const resourceDetails = <ResourceDetails id={id} router={router} />;
      currentView.value = resourceDetails;
    } else if (path === "/dashboard/") {
      // @ts-ignore: JSX types
      const dashboard = <Dashboard router={router} />;
      currentView.value = dashboard;
    } else {
      currentView.value = <div>404 - Not Found</div>;
    }
  });

  return (
    <div class="min-h-screen bg-gray-100">
      <Navigation router={router} />
      <main class="container mx-auto px-4 py-8">{currentView}</main>
    </div>
  );
}
