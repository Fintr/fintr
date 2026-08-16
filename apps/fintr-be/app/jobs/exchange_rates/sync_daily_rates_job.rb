# frozen_string_literal: true

module ExchangeRates
  class SyncDailyRatesJob < ApplicationJob
    queue_as :default

    LOOKBACK_DAYS = 14

    def self.dates_needing_sync
      today = Date.current
      start_date = today - LOOKBACK_DAYS.days

      (start_date..today).select do |date|
        !ExchangeRates::ApiExchangeRate.full_snapshot_for_date?(date: date)
      end
    end

    def self.enqueue_if_needed!
      return if dates_needing_sync.empty?
      return if pending?

      perform_later
    end

    def self.pending?
      return false unless defined?(SolidQueue::Job)
      return false unless SolidQueue::Job.table_exists?

      SolidQueue::Job.where(class_name: name, finished_at: nil).exists?
    rescue StandardError
      false
    end

    def perform
      dates_to_sync = (self.class.dates_needing_sync + [Date.current]).uniq.sort

      dates_to_sync.each do |date|
        sync_date(date:)
      end
    end

    private

    def sync_date(date:)
      result = ExchangeRates::Operations::SyncApiRates.new.call(
        date: date
      )

      if result.success?
        data = result.value!
        Rails.logger.info(
          "Synced #{data[:synced_count]} exchange rates for #{data[:date]}"
        )
      else
        Rails.logger.error(
          "Failed to sync exchange rates for #{date}: #{result.failure}"
        )
      end
    end
  end
end
