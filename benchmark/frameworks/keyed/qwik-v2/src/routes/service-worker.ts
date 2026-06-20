/*
 * WHAT IS THIS FILE?
 *
 * Keep the Qwik Router service worker route in the same place as Qwik v1.
 * Qwik 2 embeds preloading automatically, so this benchmark only needs the
 * lifecycle hooks.
 */
addEventListener("install", () => self.skipWaiting());

addEventListener("activate", () => self.clients.claim());

declare const self: ServiceWorkerGlobalScope;
