# frozen_string_literal: true

# Be sure to restart your server when you modify this file.

# Avoid CORS issues when API is called from the frontend app.
#
# Rack::Cors must run **before** Rack::MiniProfiler on the incoming request so browser
# **OPTIONS** preflights for cross-origin POSTs (e.g. to `/mini-profiler-resources/results`
# with `X-Requested-With` / `Accept`) get a 2xx CORS response. MiniProfiler does not
# implement OPTIONS on that path (would 404), which leaves SPA profiler POSTs at status 0.
# Response order is still App → MiniProfiler → Cors, so HTML/JSON profiler injection is unchanged.
#
# Read more: https://github.com/cyu/rack-cors
#
# rack-mini-profiler is development-only; +Rack::MiniProfiler+ is undefined in test/production.
# Insert at stack index 0 when the profiler is absent so CORS still applies everywhere.

cors_configuration = proc do
  allow do
    # Get allowed origins from environment variable or use defaults
    # Format in .env: CORS_ORIGINS=http://localhost:5173,http://localhost:3000
    # Include API port so browser sessions hitting localhost:3001 match CORS when needed.
    origins ENV.fetch(
      "CORS_ORIGINS",
      [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001"
      ].join(","),
    ).split(",").map(&:strip)

    resource "*",
      headers: %w[
        Authorization
        X-Space-Code
        X-Requested-With
        Content-Type
        Accept
        Cache-Control
        Connection
        Pragma
        Expires
        X-Accel-Buffering
      ],
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      expose: %w[
        Authorization
        X-Space-Code
        Content-Disposition
        Content-Type
        Cache-Control
        Connection
        X-MiniProfiler-Ids
        x-miniprofiler-ids
      ],
      max_age: 600
  end
end

insert_before_anchor =
  if defined?(Rack::MiniProfiler)
    Rack::MiniProfiler
  else
    0
  end

Rails.application.config.middleware.insert_before(
  insert_before_anchor,
  Rack::Cors,
  &cors_configuration
)
