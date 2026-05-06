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

    # Performance monitoring
    config.traces_sample_rate = Rails.env.production? ? 0.1 : 1.0

    # Filter sensitive data
    config.before_send = lambda do |event, hint|
      # Filter out sensitive parameters
      if event.request && event.request.data
        event.request.data = SentryDataFilter.filter_sensitive_data(event.request.data)
      end
      event
    end

    # Enable profiling in production (optional, can be expensive)
    config.profiles_sample_rate = Rails.env.production? ? 0.0 : 1.0

    # Add server name for better issue grouping
    config.server_name = ENV["SENTRY_SERVER_NAME"] if ENV["SENTRY_SERVER_NAME"].present?

    # Enable source map support for better stack traces
    config.send_default_pii = false
  end
end
