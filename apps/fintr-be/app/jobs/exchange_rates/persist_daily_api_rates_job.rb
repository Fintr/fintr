# frozen_string_literal: true

module ExchangeRates
  # Persists the full USD-base rate snapshot returned by the external API for one date.
  # Enqueued from on-demand FetchRate lookups so request paths only sync missing pairs
  # synchronously while the rest of the day's rates are written in the background.
  class PersistDailyApiRatesJob < ApplicationJob
    queue_as :default

    limits_concurrency to: 1,
                       key: ->(date:, **) { "exchange_rates/persist_daily/#{date}" },
                       duration: 30.minutes

    # Enqueue at most one unfinished job per date when a full API snapshot is available.
    # Returns true when a job is already pending/running or was just enqueued; false when
    # rates are blank or the DB already has a full snapshot.
    def self.enqueue_for_date(date:, rates:)
      return false if rates.blank?

      parsed_date = date.to_date
      date_str = parsed_date.to_s
      return false if ExchangeRates::ApiExchangeRate.full_snapshot_for_date?(date: parsed_date)
      return true if pending_for_date?(date_str)

      perform_later(
        date: date_str,
        rates: rates
      )
      true
    end

    def self.pending_for_date?(date_str)
      return false unless defined?(SolidQueue::Job)
      return false unless SolidQueue::Job.table_exists?

      SolidQueue::Job
        .where(class_name: name, finished_at: nil)
        .where("arguments LIKE ?", "%#{date_str}%")
        .exists?
    rescue StandardError
      false
    end

    def perform(date:, rates: nil)
      parsed_date = Date.parse(date.to_s)
      snapshot = normalize_rates(rates)
      snapshot = fetch_snapshot(parsed_date) if snapshot.blank?
      return if snapshot.blank?

      result = ExchangeRates::Operations::PersistApiRates.new.call(
        rates: snapshot,
        date: parsed_date
      )
      return if result.success?

      Rails.logger.warn(
        "[ExchangeRates::PersistDailyApiRatesJob] Failed for #{parsed_date}: " \
        "#{result.failure.inspect}"
      )
    end

    private

    def normalize_rates(rates)
      return {} if rates.blank?

      rates.stringify_keys.transform_keys(&:upcase)
    end

    def fetch_snapshot(date)
      result = ExchangeRates::Operations::FetchRatesFromApi.new.call(
        base_currency: ExchangeRates::ApiExchangeRate::BASE_CURRENCY,
        date: date
      )
      return {} unless result.success?

      result.value!
    end
  end
end
