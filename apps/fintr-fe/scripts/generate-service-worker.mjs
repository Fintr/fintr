/**
 * Post-build: write out/sw.js with a precache manifest for the static export.
 * Run after `next build` when `out/` exists.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const feRoot = path.resolve(__dirname, "..");
const outDir = path.join(feRoot, "out");
const swDest = path.join(outDir, "sw.js");

const MAX_PRECACHE_BYTES = 5 * 1024 * 1024;
const SKIP_DIR_NAMES = new Set(["videos"]);

function collectPrecacheUrls(rootDir, relativeDir = "") {
  const absoluteDir = path.join(rootDir, relativeDir);
  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  const urls = [];

  for (const entry of entries) {
    const relativePath = relativeDir
      ? `${relativeDir}/${entry.name}`
      : entry.name;

    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) {
        continue;
      }

      urls.push(...collectPrecacheUrls(rootDir, relativePath));
      continue;
    }

    if (entry.name === "sw.js" || entry.name === "sw-dev.js") {
      continue;
    }

    const absolutePath = path.join(rootDir, relativePath);
    const { size } = fs.statSync(absolutePath);

    if (size > MAX_PRECACHE_BYTES) {
      console.warn(
        `[generate-service-worker] Skipping large file (${size} bytes): /${relativePath}`,
      );
      continue;
    }

    urls.push(`/${relativePath.split(path.sep).join("/")}`);
  }

  return urls;
}

function buildServiceWorkerSource(cacheName, precacheUrls) {
  const manifestJson = JSON.stringify(precacheUrls);

  return `/* Fintr service worker — generated; do not edit */
const CACHE_NAME = "${cacheName}";
const PRECACHE_URLS = ${manifestJson};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("fintr-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

function shouldHandleRequest(request) {
  if (request.method !== "GET") {
    return false;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return false;
  }

  if (url.pathname.startsWith("/api/")) {
    return false;
  }

  return true;
}

function navigationCandidates(pathname) {
  const candidates = [];

  if (pathname.endsWith("/")) {
    candidates.push(pathname + "index.html");
    if (pathname.length > 1) {
      candidates.push(pathname.slice(0, -1) + ".html");
    }
  } else if (pathname.endsWith(".html")) {
    candidates.push(pathname);
  } else {
    candidates.push(pathname + ".html");
    candidates.push(pathname + "/index.html");
  }

  candidates.push("/index.html");

  return candidates;
}

async function resolveNavigation(request) {
  const url = new URL(request.url);

  for (const candidate of navigationCandidates(url.pathname)) {
    const cached = await caches.match(candidate);

    if (cached) {
      return cached;
    }
  }

  return null;
}

self.addEventListener("fetch", (event) => {
  if (!shouldHandleRequest(event.request)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }

          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));

          return response;
        })
        .catch(async () => {
          if (event.request.mode === "navigate") {
            const navigationResponse = await resolveNavigation(event.request);

            if (navigationResponse) {
              return navigationResponse;
            }
          }

          const fallback = await caches.match(event.request);

          if (fallback) {
            return fallback;
          }

          return new Response("Offline", {
            status: 503,
            statusText: "Offline",
          });
        });
    }),
  );
});
`;
}

if (!fs.existsSync(outDir)) {
  console.error(
    "[generate-service-worker] out/ not found — run next build first.",
  );
  process.exit(1);
}

const precacheUrls = collectPrecacheUrls(outDir);
const cacheName = `fintr-shell-${Date.now()}`;
const source = buildServiceWorkerSource(cacheName, precacheUrls);

fs.writeFileSync(swDest, source, "utf8");

console.log(
  `[generate-service-worker] Wrote ${swDest} (${precacheUrls.length} precache entries, cache ${cacheName})`,
);
