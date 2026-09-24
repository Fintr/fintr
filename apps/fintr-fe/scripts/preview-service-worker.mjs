/**
 * Minimal service worker for local static preview.
 * Replaces any prior production shell worker so navigation (e.g. /auth-callback)
 * is not intercepted by a broken precache handler.
 */
import fs from "node:fs";
import path from "node:path";

export const PREVIEW_SERVICE_WORKER_SOURCE = `
self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          return caches.delete(key);
        }),
      );
    }),
  );
});

self.addEventListener("fetch", function (event) {
  event.respondWith(fetch(event.request));
});
`;

export function writePreviewServiceWorker(outDir) {
  const swPath = path.join(outDir, "sw.js");
  fs.writeFileSync(swPath, PREVIEW_SERVICE_WORKER_SOURCE.trim(), "utf8");
}
