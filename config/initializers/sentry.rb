# frozen_string_literal: true

# Skip Sentry initialization in test environment to avoid cleanup issues
unless Rails.env.test?
  Sentry.init do |config|
    config.breadcrumbs_logger = [:active_support_logger]
    config.dsn = ENV["SENTRY_DSN"]
    config.traces_sample_rate = 1.0
  end
end
