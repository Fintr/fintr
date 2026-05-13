# frozen_string_literal: true

# Rack Mini Profiler — development profiling (timings, SQL, optional flamegraphs).
# https://github.com/MiniProfiler/rack-mini-profiler
#
# This app is API-only. Mini Profiler only injects scripts into **text/html** responses
# (`inject_profiler` checks Content-Type); `application/json` bodies are left unchanged.
#
# **SPA (fintr-fe):** In development, `RackMiniProfilerSpa` loads `includes.js` from
# `NEXT_PUBLIC_BE_URL` and calls `MiniProfiler.pageTransition()` on route changes so API
# requests from the Next app show the badge/timings without opening Rails HTML pages.
# Do not set `auto_inject = false`: it disables injection for *all* HTML too, which breaks
# `/rack-mini-profiler/requests` (that page is an empty shell that needs the profiler script).
#
# - Browser UI: http://localhost:<port>/rack-mini-profiler/requests
# - This route is mostly a **white page by design**. The profiler UI is the **small timing badge**
#   (default: top-left). **Click the badge** to expand SQL / timings. If you see nothing at all,
#   scroll to the corners or press Alt+P (toggle shortcut).
# - Plain HTML help (no JS): `/rack-mini-profiler/requests?pp=help`
# - If something still looks wrong: restart Rails after changing this file; hard-refresh; press Alt+P.
# - Generate some API traffic first — the UI lists profiled requests from tmp/miniprofiler.
# - Query flags: ?pp=help, ?pp=async-flamegraph (keeps JSON valid), etc.
#
# AI / tooling: profiles under tmp/miniprofiler/ (FileStore); response headers include x-miniprofiler-ids.
if Rails.env.development? && defined?(Rack::MiniProfiler)
  Rack::MiniProfiler.config.tap do |c|
    # Easier to spot than bottom-right on a blank page.
    c.position = "top-left"
    c.start_hidden = false
    c.show_total_sql_count = true
    # Match README default; use Alt+P to toggle if you enable HTML responses elsewhere.
    c.toggle_shortcut = "alt+p"
    # Keep schema dumps out of SQL lists unless you need them.
    c.skip_schema_queries = true
  end
end
