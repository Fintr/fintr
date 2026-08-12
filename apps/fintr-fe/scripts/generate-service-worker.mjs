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
const PRECACHE_BATCH_SIZE = 8;
// On-demand / marketing assets — skipping them keeps install reliable for
// dashboard shell + profile/badge illustrations offline.
const SKIP_DIR_NAMES = new Set([
  "videos",
  "circle-flags",
  "Tablet App Features_04.01.26",
]);

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

function precachePriorityTier(url) {
  if (
    url.startsWith("/profiles/")
    || url.startsWith("/badges/")
    || url.startsWith("/fintr-logo")
    || url === "/favicon.ico"
  ) {
    return 0;
  }

  if (
    url.startsWith("/dashboard/")
    || url === "/dashboard.html"
    || url === "/index.html"
    || url === "/offline.html"
  ) {
    return 1;
  }

  if (url.startsWith("/_next/static/")) {
    return 2;
  }

  return 3;
}

function orderPrecacheUrls(urls) {
  return [...urls].sort((left, right) => {
    const tierDelta = precachePriorityTier(left) - precachePriorityTier(right);

    if (tierDelta !== 0) {
      return tierDelta;
    }

    return left.localeCompare(right);
  });
}

function buildServiceWorkerSource(cacheName, precacheUrls) {
  const manifestJson = JSON.stringify(precacheUrls);

  return `/* Fintr service worker — generated; do not edit */
const CACHE_NAME = "${cacheName}";
const PRECACHE_URLS = ${manifestJson};
const PRECACHE_BATCH_SIZE = ${PRECACHE_BATCH_SIZE};
const CACHE_MATCH_OPTIONS = { ignoreVary: true };

async function precacheInBatches(cache, urls) {
  for (let index = 0; index < urls.length; index += PRECACHE_BATCH_SIZE) {
    const batch = urls.slice(index, index + PRECACHE_BATCH_SIZE);
    await Promise.allSettled(batch.map((url) => cache.add(url)));
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => precacheInBatches(cache, PRECACHE_URLS)),
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

  if (
    url.pathname === "/auth-callback" ||
    url.pathname === "/login" ||
    url.pathname === "/consent" ||
    url.pathname.startsWith("/auth/")
  ) {
    return false;
  }

  return true;
}

function normalizePathname(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

async function resolveCachedByPathname(pathname) {
  const target = normalizePathname(pathname);
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();

  for (const request of requests) {
    const url = new URL(request.url);
    const candidate = normalizePathname(url.pathname);

    if (candidate === target) {
      const response = await cache.match(request, CACHE_MATCH_OPTIONS);

      if (response) {
        return response;
      }
    }
  }

  return null;
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

async function openCurrentCache() {
  return caches.open(CACHE_NAME);
}

async function resolveNavigation(request) {
  const url = new URL(request.url);
  const cache = await openCurrentCache();

  for (const candidate of navigationCandidates(url.pathname)) {
    const cached = await cache.match(candidate, CACHE_MATCH_OPTIONS);

    if (cached) {
      return cached;
    }

    const cachedUrl = await cache.match(
      new URL(candidate, url.origin).href,
      CACHE_MATCH_OPTIONS,
    );

    if (cachedUrl) {
      return cachedUrl;
    }
  }

  return null;
}

async function resolveAppShell() {
  const shellPaths = [
    "/dashboard/home.html",
    "/dashboard/home/index.html",
    "/dashboard/insights.html",
    "/dashboard/insights/index.html",
    "/dashboard/app_settings.html",
    "/dashboard/app_settings/index.html",
    "/dashboard.html",
    "/dashboard/index.html",
    "/index.html",
    "/",
  ];

  const cache = await openCurrentCache();

  for (const path of shellPaths) {
    const cached = await cache.match(path, CACHE_MATCH_OPTIONS);

    if (cached) {
      return cached;
    }
  }

  return null;
}

function isBrowserOffline() {
  return typeof self.navigator !== "undefined" && self.navigator.onLine === false;
}

function offlineResponse() {
  return new Response(null, {
    status: 503,
    statusText: "Network Offline",
  });
}

async function resolveOfflineFallback(request) {
  const cache = await openCurrentCache();
  const cached = await cache.match(request, CACHE_MATCH_OPTIONS);

  if (cached) {
    return cached;
  }

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    const navigationResponse = await resolveNavigation(request);

    if (navigationResponse) {
      return navigationResponse;
    }

    const shell = await resolveAppShell();

    if (shell) {
      return shell;
    }

    return offlineResponse();
  }

  const byPath = await resolveCachedByPathname(url.pathname);

  if (byPath) {
    return byPath;
  }

  return offlineResponse();
}

async function cacheResponse(request, response) {
  if (!response || response.status !== 200) {
    return;
  }

  const copy = response.clone();
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, copy);
}

async function handleRequest(request) {
  const cache = await openCurrentCache();
  const url = new URL(request.url);

  // Static export routes are stored as *.html — resolve before exact URL cache hits.
  if (request.mode === "navigate") {
    const navigationResponse = await resolveNavigation(request);

    if (navigationResponse) {
      return navigationResponse;
    }
  }

  const cached = await cache.match(request, CACHE_MATCH_OPTIONS);

  if (cached) {
    return cached;
  }

  // Profile/badge/public assets may be cached under a different Request
  // (precache vs <img>); match by pathname before hitting the network.
  const byPath = await resolveCachedByPathname(url.pathname);

  if (byPath) {
    return byPath;
  }

  if (isBrowserOffline()) {
    return resolveOfflineFallback(request);
  }

  try {
    const response = await fetch(request);

    if (request.mode === "navigate" && !response.ok) {
      const navigationResponse = await resolveNavigation(request);

      if (navigationResponse) {
        return navigationResponse;
      }

      const shell = await resolveAppShell();

      if (shell) {
        return shell;
      }
    }

    await cacheResponse(request, response);
    return response;
  } catch {
    return resolveOfflineFallback(request);
  }
}

self.addEventListener("fetch", (event) => {
  if (!shouldHandleRequest(event.request)) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        return await handleRequest(event.request);
      } catch (error) {
        console.error("[fintr-sw] handler failed; using network", error);
        return fetch(event.request);
      }
    })(),
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

const precacheUrls = orderPrecacheUrls(collectPrecacheUrls(outDir));
const cacheName = `fintr-shell-${Date.now()}`;
const source = buildServiceWorkerSource(cacheName, precacheUrls);

fs.writeFileSync(swDest, source, "utf8");

const serveConfigDest = path.join(outDir, "serve.json");
const serveConfig = {
  cleanUrls: true,
  trailingSlash: false,
};
fs.writeFileSync(serveConfigDest, JSON.stringify(serveConfig, null, 2), "utf8");

console.log(
  `[generate-service-worker] Wrote ${swDest} (${precacheUrls.length} precache entries, cache ${cacheName})`,
);
console.log(`[generate-service-worker] Wrote ${serveConfigDest} (cleanUrls for static preview)`);
