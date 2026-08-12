/* Fintr dev service worker — runtime cache for offline dev on localhost */
const CACHE_NAME = "fintr-dev-runtime-v5";
const CACHE_MATCH_OPTIONS = { ignoreVary: true };

const PRECACHE_PATHS = [
  "/",
  "/login",
  "/dashboard",
  "/dashboard/home",
  "/dashboard/insights",
  "/dashboard/app_settings",
  "/profiles/strong_saver.png",
  "/profiles/high_earner.png",
  "/profiles/steady_investor.png",
  "/profiles/avid_spender.png",
  "/profiles/balanced_budgeter.png",
  "/profiles/debt_crusher.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(PRECACHE_PATHS.map((path) => cache.add(path))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("fintr-dev-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

function isBrowserOffline() {
  return typeof self.navigator !== "undefined" && self.navigator.onLine === false;
}

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
    candidates.push(`${pathname}index.html`);
    if (pathname.length > 1) {
      candidates.push(`${pathname.slice(0, -1)}.html`);
    }
  } else if (pathname.endsWith(".html")) {
    candidates.push(pathname);
  } else {
    candidates.push(`${pathname}.html`);
    candidates.push(`${pathname}/index.html`);
  }

  candidates.push("/index.html");

  return candidates;
}

async function resolveNavigation(request) {
  const url = new URL(request.url);

  for (const candidate of navigationCandidates(url.pathname)) {
    const cached = await caches.match(candidate, CACHE_MATCH_OPTIONS);

    if (cached) {
      return cached;
    }

    const cachedUrl = await caches.match(
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
    "/dashboard/home",
    "/dashboard/insights",
    "/dashboard/app_settings",
    "/dashboard",
    "/index.html",
    "/",
  ];

  for (const path of shellPaths) {
    const cached = await caches.match(path, CACHE_MATCH_OPTIONS);

    if (cached) {
      return cached;
    }
  }

  return null;
}

function offlineResponse() {
  return new Response(null, {
    status: 503,
    statusText: "Network Offline",
  });
}

async function resolveOfflineFallback(request) {
  const cached = await caches.match(request, CACHE_MATCH_OPTIONS);

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
  const cached = await caches.match(request, CACHE_MATCH_OPTIONS);

  if (cached) {
    return cached;
  }

  const url = new URL(request.url);
  const byPath = await resolveCachedByPathname(url.pathname);

  if (byPath) {
    return byPath;
  }

  if (isBrowserOffline()) {
    return resolveOfflineFallback(request);
  }

  try {
    const response = await fetch(request);
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

  event.respondWith(handleRequest(event.request));
});
