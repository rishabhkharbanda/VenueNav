/**
 * Workbox runtime routes (used by service-worker.ts).
 * Map JSON: SWR. Live edges: network-first. Raster: SWR. Server routing: network-only (app uses local offline path).
 */
import { NavigationRoute, registerRoute } from "workbox-routing";
import { StaleWhileRevalidate, NetworkFirst, NetworkOnly } from "workbox-strategies";
import { createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any };

const PAYLOAD = "venuenav-api-payload";
const EVENT_META = "venuenav-event-map-meta";
const LIVE = "venuenav-live-edges";
const IMAGES = "venuenav-raster";

function isV1Path(pathname: string): boolean {
  return pathname.startsWith("/v1/");
}

export function installPrecache() {
  precacheAndRoute(self.__WB_MANIFEST);
  const handler = createHandlerBoundToURL("/index.html");
  registerRoute(
    new NavigationRoute(handler, {
      denylist: [/^\/v1\//],
    })
  );
  self.skipWaiting();
  clientsClaim();
}

export function installRuntimeCaching() {
  // Server-side routing: never cache; offline routing is computed in the app.
  registerRoute(
    ({ url, request }) =>
      request.method === "GET" && isV1Path(url.pathname) && /\/v1\/public\/maps\/[^/]+\/route$/.test(url.pathname),
    new NetworkOnly()
  );

  registerRoute(
    ({ url, request }) =>
      request.method === "GET" &&
      isV1Path(url.pathname) &&
      /\/v1\/public\/events\/.+\/maps\//.test(url.pathname),
    new StaleWhileRevalidate({
      cacheName: EVENT_META,
      plugins: [new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 7 * 24 * 3600 })],
    })
  );

  registerRoute(
    ({ url, request }) =>
      request.method === "GET" &&
      isV1Path(url.pathname) &&
      /\/v1\/public\/maps\/[^/]+\/payload/.test(url.pathname),
    new StaleWhileRevalidate({
      cacheName: PAYLOAD,
      plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 7 * 24 * 3600 })],
    })
  );

  registerRoute(
    ({ url, request }) =>
      request.method === "GET" && isV1Path(url.pathname) && /live-edges/.test(url.pathname),
    new NetworkFirst({
      networkTimeoutSeconds: 4,
      cacheName: LIVE,
      plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 300 })],
    })
  );

  registerRoute(
    ({ request, url }) =>
      request.method === "GET" && /\.(png|jpe?g|webp|gif|svg)(?:\?.*)?$/i.test(url.pathname),
    new StaleWhileRevalidate({
      cacheName: IMAGES,
      plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * 24 * 3600 })],
    })
  );
}
