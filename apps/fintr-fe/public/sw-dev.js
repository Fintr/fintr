/* Fintr dev service worker — runtime cache for offline dev on localhost */
const CACHE_NAME = "fintr-dev-runtime-v8";
const CACHE_MATCH_OPTIONS = { ignoreVary: true, ignoreSearch: true };
const CACHE_MATCH_STRICT = { ignoreVary: true };

function hasAppDetailSearch(url) {
  return (
    url.searchParams.has("transactionId")
    || url.searchParams.has("loanId")
    || url.searchParams.has("accountId")
    || url.searchParams.has("entityId")
    || url.searchParams.has("categoryId")
  );
}

async function matchCachedRequest(cache, request) {
  const url = new URL(request.url);
  const options = hasAppDetailSearch(url) ? CACHE_MATCH_STRICT : CACHE_MATCH_OPTIONS;

  return cache.match(request, options);
}

const PRECACHE_PATHS = [
  "/",
  "/login",
  "/dashboard",
  "/dashboard/home",
  "/dashboard/insights",
  "/dashboard/app_settings",
  "/dashboard/budgets",
  "/dashboard/loans",
  "/dashboard/settings",
  "/dashboard/space_settings/entities",
  "/dashboard/space_settings/accounts",
  "/dashboard/space_settings/categories",
  "/dashboard/space_settings/tags",
  "/profiles/strong_saver.png",
  "/profiles/high_earner.png",
  "/profiles/steady_investor.png",
  "/profiles/avid_spender.png",
  "/profiles/balanced_budgeter.png",
  "/profiles/debt_crusher.png",
  "/badges/rookie_tracker.png",
  "/badges/receipt_rookie.png",
  "/badges/steady_logger.png",
  "/badges/fierce_budgeter.png",
  "/badges/super_saver.png",
  "/badges/goal_getter.png",
  "/badges/cashflow_captain.png",
  "/badges/ledger_legend.png",
  "/badges/wealth_weaver.png",
  "/badges/money_maestro.png",
  "/badges/penny_pioneer.png",
  "/badges/habit_hacker.png",
  "/badges/ledger_climber.png",
  "/badges/fifty_strong.png",
  "/badges/century_chronicler.png",
  "/badges/double_century.png",
  "/badges/triple_tracker.png",
  "/badges/half_grand_historian.png",
  "/badges/thousand_tales.png",
  "/badges/budget_beast.png",
  "/badges/crew_caller.png",
  "/badges/first_lien.png",
  "/badges/loan_stacker.png",
  "/badges/debt_dynamo.png",
  "/badges/payback_starter.png",
  "/badges/installment_ace.png",
  "/badges/repayment_pro.png",
  "/badges/hop_starter.png",
  "/badges/account_hopper.png",
  "/badges/transfer_titan.png",
  "/badges/wire_wizard.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(PRECACHE_PATHS.map((path) => cache.add(path))),
    ).then(() => self.skipWaiting()),
  );
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

function isStaticAssetRequest(request) {
  const destination = request.destination;

  if (
    destination === "script"
    || destination === "style"
    || destination === "worker"
    || destination === "font"
  ) {
    return true;
  }

  const pathname = new URL(request.url).pathname;
  return pathname.startsWith("/_next/static/");
}

function shouldHandleRequest(request) {
  if (request.method !== "GET" && request.method !== "HEAD") {
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

function pagePathMatches(candidate, target) {
  return (
    candidate === target
    || candidate === target + ".html"
    || candidate === target + ".txt"
    || candidate === target + "/index.html"
  );
}

async function resolveCachedByPathname(pathname) {
  const target = normalizePathname(pathname);
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();

  for (const request of requests) {
    const url = new URL(request.url);
    const candidate = normalizePathname(url.pathname);

    if (pagePathMatches(candidate, target)) {
      const response = await cache.match(request, CACHE_MATCH_OPTIONS);

      if (response) {
        return response;
      }
    }
  }

  return (
    (await cache.match(target, CACHE_MATCH_OPTIONS))
    ?? (await cache.match(target + ".html", CACHE_MATCH_OPTIONS))
    ?? (await cache.match(target + ".txt", CACHE_MATCH_OPTIONS))
  );
}

function navigationCandidates(pathname) {
  const candidates = [];

  if (pathname.endsWith("/")) {
    candidates.push(`${pathname}index.html`);
    if (pathname.length > 1) {
      candidates.push(`${pathname.slice(0, -1)}.html`);
      candidates.push(pathname.slice(0, -1));
    }
  } else if (pathname.endsWith(".html")) {
    candidates.push(pathname);
    candidates.push(pathname.slice(0, -5));
  } else {
    candidates.push(pathname);
    candidates.push(`${pathname}.html`);
    candidates.push(`${pathname}/index.html`);
  }

  candidates.push("/index.html");
  candidates.push("/");

  return candidates;
}

async function resolveNavigation(request) {
  const url = new URL(request.url);
  const cache = await caches.open(CACHE_NAME);

  if (hasAppDetailSearch(url)) {
    const exact = await matchCachedRequest(cache, request);

    if (exact) {
      return exact;
    }
  }

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
  const cache = await caches.open(CACHE_NAME);
  const cached = await matchCachedRequest(cache, request);

  if (cached) {
    return cached;
  }

  const url = new URL(request.url);
  const byPath = await resolveCachedByPathname(url.pathname);

  if (byPath) {
    return byPath;
  }

  if (isStaticAssetRequest(request)) {
    return offlineResponse();
  }

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

  const navigationResponse = await resolveNavigation(request);

  if (navigationResponse) {
    return navigationResponse;
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
  const cache = await caches.open(CACHE_NAME);
  const cached = await matchCachedRequest(cache, request);

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

  event.respondWith(
    (async () => {
      try {
        return await handleRequest(event.request);
      } catch (error) {
        console.error("[fintr-sw] handler failed; using cached shell", error);
        return resolveOfflineFallback(event.request);
      }
    })(),
  );
});
