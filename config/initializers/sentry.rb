# frozen_string_literal: true

# Helper module to filter sensitive data from Sentry events
module SentryDataFilter
  module_function

  def filter_sensitive_data(data)
    return data unless data.is_a?(Hash)

    sensitive_keys = %w[
      password
      password_confirmation
      secret
      token
      api_key
      access_token
      refresh_token
      authorization
      auth_token
      credit_card
      cvv
      ssn
      social_security_number
    ]

    data.transform_values do |value|
      if value.is_a?(Hash)
        filter_sensitive_data(value)
      elsif value.is_a?(Array)
        value.map { |item| item.is_a?(Hash) ? filter_sensitive_data(item) : item }
      else
        value
      end
    end.transform_keys do |key|
      if sensitive_keys.any? { |sensitive| key.to_s.downcase.include?(sensitive) }
        "[FILTERED]"
      else
        key
      end
    end
  end
end

# Skip Sentry initialization in test environment to avoid cleanup issues
unless Rails.env.test?
  Sentry.init do |config|
    config.dsn = ENV["SENTRY_DSN"]
    config.environment = Rails.env
    config.breadcrumbs_logger = [:active_support_logger, :http_logger]

    # Release tracking for better issue correlation
    config.release = ENV["SENTRY_RELEASE"] if ENV["SENTRY_RELEASE"].present?

    # Performance monitoring - reduced sampling for production
    # 10% of transactions in production, 100% in development
    config.traces_sample_rate = Rails.env.production? ? 0.1 : 1.0

    # Error sampling - reduce noise from duplicate errors in production
    # Sample 50% of errors in production to reduce volume while maintaining visibility
    # This helps when the same error occurs many times (e.g., connection pool exhaustion)
    config.sample_rate = Rails.env.production? ? 0.5 : 1.0

    # Maximum number of breadcrumbs to store (default is 100, reduce for production)
    config.max_breadcrumbs = Rails.env.production? ? 50 : 100

    # Filter sensitive data and implement smart error filtering
    config.before_send = lambda do |event, hint|
      # Filter out sensitive parameters
      if event.request && event.request.data
        event.request.data = SentryDataFilter.filter_sensitive_data(event.request.data)
      end

      # In production, filter out expected failures that are too noisy
      # These are already tagged as warnings, but we can reduce volume further
      if Rails.env.production?
        # Skip expected failures that are very common (reduce noise)
        # Only send 10% of expected failures to reduce volume
        if event.tags&.dig("failure_type") == "expected" && event.tags&.dig("expected") == "true"
          return nil if rand > 0.1 # Drop 90% of expected failures
        end

        # For connection pool errors, sample more aggressively (1% only)
        # These are infrastructure issues that need fixing, not monitoring
        if event.exception&.values&.first&.type == "ActiveRecord::ConnectionNotEstablished" ||
           event.exception&.values&.first&.type == "PG::ConnectionBad"
          return nil if rand > 0.01 # Only send 1% of connection errors
        end

        # For N+1 queries, sample at 20% (these are performance issues, not critical errors)
        if event.tags&.dig("performance") == "n_plus_one"
          return nil if rand > 0.2
        end
      end

      event
    end

    # Enable profiling in production (optional, can be expensive)
    # Keep disabled in production unless specifically needed for performance debugging
    config.profiles_sample_rate = Rails.env.production? ? 0.0 : 1.0

    # Add server name for better issue grouping
    config.server_name = ENV["SENTRY_SERVER_NAME"] if ENV["SENTRY_SERVER_NAME"].present?

    # Enable source map support for better stack traces
    config.send_default_pii = false

    # Transport configuration for production
    if Rails.env.production?
      # Use async transport to avoid blocking requests
      config.transport.timeout = 10
      config.transport.open_timeout = 10

      # Limit the number of queued events to prevent memory issues
      config.transport.max_queue_size = 30
    end

    # Ignore common, non-critical errors that don't need monitoring
    config.excluded_exceptions += [
      "ActionController::RoutingError", # 404s - not errors
      "AbstractController::ActionNotFound", # 404s - not errors
      "ActiveRecord::RecordNotFound" # Already handled as expected failures
    ]

    # Configure issue grouping for better organization
    # Group similar errors together to reduce noise
    config.before_send_transaction = lambda do |event, hint|
      # Add transaction name as tag for better filtering
      if event.transaction
        event.tags ||= {}
        event.tags[:transaction_name] = event.transaction
      end
      event
    end
  end
end
