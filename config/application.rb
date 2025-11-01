# frozen_string_literal: true

require_relative "boot"

require "rails/all"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

require_relative "../app/middlewares/snake_case_parameters"
module FintrBe
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.0

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # config.time_zone = "Central Time (US & Canada)"
    # config.eager_load_paths << Rails.root.join("extras")

    # Only loads a smaller set of middleware suitable for API only apps.
    # Middleware like session, flash, cookies can be added back manually.
    # Skip views, helpers and assets when generating a new resource.
    config.api_only = true

    # Enable sessions for Solid Queue Monitor
    config.session_store :cookie_store, key: "_fintr_session"

    # Only assume SSL in production and staging environments
    config.assume_ssl = Rails.env.production? || Rails.env.staging?

    # Client URL for redirections (Auth0 callbacks)
    config.client_url = ENV.fetch("CLIENT_URL", "http://localhost:3000")

    config.middleware.use SnakeCaseParameters

    # Add session middleware for Solid Queue Monitor
    config.middleware.use ActionDispatch::Cookies
    config.middleware.use ActionDispatch::Session::CookieStore

    # Configure factory file naming pattern
    config.generators do |g|
      g.factory_bot suffix: "factory"
      g.factory_bot dir: "spec/factories"
    end
  end
end
