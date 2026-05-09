/**
 * Sync with Rack::MiniProfiler::ASSET_VERSION when upgrading rack-mini-profiler:
 * `cd apps/fintr-be && mise exec -- ruby -e "require 'rack-mini-profiler'; puts Rack::MiniProfiler::ASSET_VERSION"`
 *
 * rack-mini-profiler (4.0.1)
 */
export const RACK_MINI_PROFILER_ASSET_VERSION =
  "e0bcc9ce0ae3bb5d6b736b6f282f601f";
