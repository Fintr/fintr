/* Fintr dev service worker — runtime cache for offline dev on localhost */
const CACHE_NAME = "fintr-dev-runtime-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled([
        cache.add("/"),
        cache.add("/dashboard"),
        cache.add("/login"),
      ]),
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
    const cached = await caches.match(candidate);

    if (cached) {
      return cached;
    }

    const cachedUrl = await caches.match(
      new URL(candidate, url.origin).href,
    );

    if (cachedUrl) {
      return cachedUrl;
    }
  }

  return null;
}

self.addEventListener("fetch", (event) => {
  if (!shouldHandleRequest(event.request)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);

        if (cached) {
          return cached;
        }

        if (event.request.mode === "navigate") {
          const navigationResponse = await resolveNavigation(event.request);

          if (navigationResponse) {
            return navigationResponse;
          }
        }

        return new Response("Offline", {
          status: 503,
          statusText: "Offline",
        });
      }),
  );
});
