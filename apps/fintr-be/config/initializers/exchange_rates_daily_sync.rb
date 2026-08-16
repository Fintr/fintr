# frozen_string_literal: true

Rails.application.config.after_initialize do
  next if Rails.env.test?
  next unless ENV.fetch("SOLID_QUEUE_BOOT_SYNC", "0") == "1"
  next unless defined?(SolidQueue::Job)
  next unless SolidQueue::Job.table_exists?

  ExchangeRates::SyncDailyRatesJob.enqueue_if_needed!
end
