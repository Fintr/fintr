# frozen_string_literal: true

SolidQueueMonitor.setup do |config|
  # Enable authentication in production and staging for security
  config.authentication_enabled = Rails.env.production? || Rails.env.staging?

  # Set the username for HTTP Basic Authentication (only used if authentication is enabled)
  config.username = ENV.fetch("SOLID_QUEUE_MONITOR_USERNAME", "admin")

  # Set the password for HTTP Basic Authentication (only used if authentication is enabled)
  config.password = ENV.fetch("SOLID_QUEUE_MONITOR_PASSWORD", "password")

  # Number of jobs to display per page
  config.jobs_per_page = 25
end
