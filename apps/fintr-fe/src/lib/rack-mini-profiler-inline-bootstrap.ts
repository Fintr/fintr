import { RACK_MINI_PROFILER_ASSET_VERSION } from "./rack-mini-profiler-constants";

/**
 * Runs **before** the rack-mini-profiler script tag. The gem only patches `fetch` after
 * `vendor.js` loads (see HAR: API traffic fires hundreds of ms earlier). Queue profiler IDs
 * here until `MiniProfiler.patchesApplied` is true; `RackMiniProfilerPendingFlush` drains the queue.
 */
export function miniProfilerEarlyFetchQueueScript(): string {
  return `(function(){
try {
  if (typeof window === "undefined" || window.__FINTR_MP_FETCH_SHIM__) return;
  window.__FINTR_MP_FETCH_SHIM__ = true;
  window.__FINTR_MP_PENDING_IDS = window.__FINTR_MP_PENDING_IDS || [];
  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    return nativeFetch(input, init).then(function (response) {
      try {
        var mp = window.MiniProfiler;
        if (mp && mp.patchesApplied) return response;
        var raw = response.headers.get("x-miniprofiler-ids");
        if (!raw) return response;
        raw.split(",").forEach(function (part) {
          var id = part.trim();
          if (!id) return;
          if (window.__FINTR_MP_PENDING_IDS.indexOf(id) === -1) {
            window.__FINTR_MP_PENDING_IDS.push(id);
          }
        });
      } catch (e) {}
      return response;
    });
  };
} catch (e) {
  console.error("[rack-mini-profiler] early fetch shim failed", e);
}
})();`;
}

/**
 * Inline IIFE for root layout: injects `includes.js` + data attributes at HTML parse time.
 */
export function miniProfilerInlineBootstrapScript(apiBaseRaw: string): string {
  const apiBase = apiBaseRaw.replace(/\/$/, "");
  const v = RACK_MINI_PROFILER_ASSET_VERSION;
  const q = (s: string) => JSON.stringify(s);

  return `(function(){
try {
  if (typeof document === "undefined") return;
  if (document.getElementById("mini-profiler")) return;
  var s = document.createElement("script");
  s.async = false;
  s.id = "mini-profiler";
  s.type = "text/javascript";
  s.src = ${q(`${apiBase}/mini-profiler-resources/includes.js?v=${v}`)};
  s.setAttribute("data-version", ${q(v)});
  s.setAttribute("data-path", ${q(`${apiBase}/mini-profiler-resources/`)});
  s.setAttribute("data-css-url", ${q(`${apiBase}/mini-profiler-resources/includes.css?v=${v}`)});
  s.setAttribute("data-current-id", "");
  s.setAttribute("data-horizontal-position", "left");
  s.setAttribute("data-vertical-position", "top");
  s.setAttribute("data-trivial", "false");
  s.setAttribute("data-children", "false");
  s.setAttribute("data-max-traces", "20");
  s.setAttribute("data-controls", "false");
  s.setAttribute("data-total-sql-count", "true");
  s.setAttribute("data-authorized", "true");
  s.setAttribute("data-toggle-shortcut", "alt+p");
  s.setAttribute("data-start-hidden", "false");
  s.setAttribute("data-collapse-results", "false");
  s.setAttribute("data-html-container", "body");
  s.setAttribute("data-hidden-custom-fields", "");
  s.setAttribute("data-turbo-permanent", "false");
  s.addEventListener("error", function () {
    console.error("[rack-mini-profiler] Failed to load includes.js from", s.src);
  });
  (document.body || document.head).appendChild(s);
  window.__FINTR_RACK_MINI_PROFILER_BOOTSTRAP__ = true;
} catch (e) {
  console.error("[rack-mini-profiler] inline bootstrap failed", e);
}
})();`;
}
