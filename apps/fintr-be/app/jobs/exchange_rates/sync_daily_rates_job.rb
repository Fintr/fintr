# frozen_string_literal: true

module ExchangeRates
  class SyncDailyRatesJob < ApplicationJob
    queue_as :default

    def perform
      result = ExchangeRates::Operations::SyncApiRates.new.call({})

      if result.success?
        data = result.value!
        Rails.logger.info("Synced #{data[:synced_count]} exchange rates for #{data[:date]}")
      else
        Rails.logger.error("Failed to sync exchange rates: #{result.failure}")
      end
    end
  end
end
