import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const generatorSource = readFileSync(
  path.resolve(__dirname, "../../scripts/generate-service-worker.mjs"),
  "utf8",
);

const devWorkerSource = readFileSync(
  path.resolve(__dirname, "../../public/sw-dev.js"),
  "utf8",
);

describe("service worker offline policy", () => {
  it("matches cached assets without query strings so RSC payloads work offline", () => {
    expect(generatorSource).toContain("ignoreSearch: true");
    expect(devWorkerSource).toContain("ignoreSearch: true");
  });

  it("does not ignoreSearch for detail ids so empty prefetched shells cannot win", () => {
    expect(generatorSource).toContain("function hasAppDetailSearch");
    expect(generatorSource).toContain("transactionId");
    expect(generatorSource).toContain("loanId");
    expect(devWorkerSource).toContain("function hasAppDetailSearch");
    expect(devWorkerSource).toContain("function matchCachedRequest");
    expect(generatorSource).toContain("function matchCachedRequest");
  });

  it("does not fall back to offline.html when a cached app shell exists", () => {
    expect(generatorSource).not.toContain("resolveOfflineHtml");
    expect(generatorSource).not.toMatch(/cache\.match\("\/offline\.html"/);
    expect(devWorkerSource).not.toMatch(/cache\.match\("\/offline\.html"/);
  });

  it("does not fall back to the network when the fetch handler fails", () => {
    expect(generatorSource).not.toContain("return fetch(event.request)");
    expect(devWorkerSource).not.toContain("return fetch(event.request)");
  });

  it("precaches badge illustrations for offline settings", () => {
    expect(generatorSource).toContain('"/badges/"');
    expect(devWorkerSource).toContain("/badges/rookie_tracker.png");
  });

  it("precaches tag sample styles for offline tag editing", () => {
    expect(generatorSource).toContain('"/tags/"');
    expect(devWorkerSource).toContain("/tags/japan-vacation.png");
  });

  it("handles HEAD probes so Next.js route checks do not hit the network", () => {
    expect(generatorSource).toContain('request.method !== "HEAD"');
    expect(devWorkerSource).toContain('request.method !== "HEAD"');
  });

  it("matches bare page paths to precached .html and .txt files", () => {
    expect(generatorSource).toContain('target + ".html"');
    expect(generatorSource).toContain('target + ".txt"');
    expect(devWorkerSource).toContain('target + ".html"');
    expect(devWorkerSource).toContain('target + ".txt"');
  });

  it("precaches clean page URLs so serve cleanUrls does not reject .html cache.add", () => {
    expect(generatorSource).toContain('url.endsWith(".html")');
    expect(generatorSource).toContain("candidates.push(pathname)");
  });

  it("does not skipWaiting until /_next/static/ chunks are in the new cache", () => {
    const installHandler = generatorSource.slice(
      generatorSource.indexOf('self.addEventListener("install"'),
      generatorSource.indexOf('self.addEventListener("activate"'),
    );

    expect(installHandler).toMatch(/await precacheInBatches[\s\S]*skipWaiting/);
    expect(installHandler).toMatch(/shellPrecacheReady[\s\S]*skipWaiting/);
  });

  it("keeps the previous shell cache until JS chunks are actually cached", () => {
    const prefixes = generatorSource.match(
      /SHELL_CRITICAL_PREFIXES = (\[[\s\S]*?\]);/,
    )?.[1];

    expect(prefixes).toContain("/_next/static/");
    expect(generatorSource).toMatch(
      /if \(!ready\) \{[\s\S]*Keeping previous shell caches[\s\S]*return;/,
    );
  });

  it("retries failed /_next/static/ precache instead of dropping those chunks", () => {
    expect(generatorSource).toContain("retryFailedShellPrecache");
  });

  it("does not serve cached HTML when a JS or CSS asset is missing", () => {
    expect(generatorSource).toContain("function isStaticAssetRequest");
    expect(generatorSource).toMatch(
      /if \(isStaticAssetRequest\(request\)\) \{\s*return offlineResponse\(\);/,
    );
    expect(devWorkerSource).toContain("function isStaticAssetRequest");
  });

  it("fetches online navigations before returning a cached page in sw-dev", () => {
    const handleRequest = handleRequestSource(devWorkerSource);
    const navigateIdx = handleRequest.indexOf('request.mode === "navigate"');
    const cacheIdx = handleRequest.indexOf("matchCachedRequest");

    expect(navigateIdx).toBeGreaterThan(-1);
    expect(navigateIdx).toBeLessThan(cacheIdx);
    expect(handleRequest).toContain("await fetch(request)");
    expect(handleRequest).toContain("!isBrowserOffline()");
  });

  it("fetches /_next/static/ from the network before cache in sw-dev", () => {
    const handleRequest = handleRequestSource(devWorkerSource);
    const staticIdx = handleRequest.indexOf("isStaticAssetRequest(request)");
    const cacheIdx = handleRequest.indexOf("matchCachedRequest");

    expect(staticIdx).toBeGreaterThan(-1);
    expect(staticIdx).toBeLessThan(cacheIdx);
  });

  it("does not treat a cached HTML document as the signup flight payload", () => {
    expect(devWorkerSource).toContain("function isRscRequest");
    expect(devWorkerSource).toContain("function isHtmlResponse");
    expect(generatorSource).toContain("function isRscRequest");
    expect(generatorSource).toContain("function isHtmlResponse");
    expect(devWorkerSource).toContain("isRscRequest(request) && isHtmlResponse(byPath)");
    expect(generatorSource).toContain("isRscRequest(request) && isHtmlResponse(byPath)");
  });

  it("does not intercept the service worker script itself in sw-dev", () => {
    expect(devWorkerSource).toContain('url.pathname === "/sw-dev.js"');
    expect(devWorkerSource).toContain('url.pathname === "/sw.js"');
  });
});

function handleRequestSource(source: string): string {
  return source.slice(
    source.indexOf("async function handleRequest"),
    source.indexOf('self.addEventListener("fetch"'),
  );
}
