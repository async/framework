import { component$ } from "@qwik.dev/core";
import {
  QwikCityProvider,
  RouterOutlet,
  // ServiceWorkerRegister,
} from "@qwik.dev/router";
import { RouterHead } from "./components/router-head/router-head";

export default component$(() => {
  /**
   * The root of a QwikCity site always start with the <QwikCityProvider> component,
   * immediately followed by the document's <head> and <body>.
   *
   * Don't remove the `<head>` and `<body>` elements.
   */

  return (
    <QwikCityProvider>
      <head>
        <meta charSet="utf-8" />
        <RouterHead />
      </head>
      <body>
        <RouterOutlet />
        {/* We don't need it for this benchmark */}
        {/* <ServiceWorkerRegister /> */}
      </body>
    </QwikCityProvider>
  );
});
