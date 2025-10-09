# frozen_string_literal: true

# Be sure to restart your server when you modify this file.

# Avoid CORS issues when API is called from the frontend app.
# Handle Cross-Origin Resource Sharing (CORS) in order to accept cross-origin Ajax requests.

# Read more: https://github.com/cyu/rack-cors

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    # Get allowed origins from environment variable or use defaults
    # Format in .env: CORS_ORIGINS=http://localhost:5173,http://localhost:3000
    origins ENV.fetch("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",").map(&:strip)

    resource "/api/*",
      headers: %w[Authorization X-Space-Code Content-Type Accept Cache-Control Connection Pragma Expires X-Accel-Buffering],
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      expose: %w[Authorization X-Space-Code Content-Disposition Content-Type Cache-Control Connection],
      max_age: 600
  end
end
