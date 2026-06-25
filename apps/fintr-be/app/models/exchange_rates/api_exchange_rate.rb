# frozen_string_literal: true

module ExchangeRates
  class ApiExchangeRate < ApplicationRecord
    self.table_name = "api_exchange_rates"

    BASE_CURRENCY = "USD"

    validates :base_currency, :target_currency, :rate, :rate_date, presence: true
    validates :rate, numericality: { greater_than: 0 }
    validates :base_currency, inclusion: { in: [BASE_CURRENCY] }
    validates :rate_date,
      uniqueness: {
        scope: [:base_currency, :target_currency],
        message: "already has a rate for this currency pair"
      }

    scope :for_target, ->(target) { where(target_currency: target) }
    scope :by_date, ->(date) { where(rate_date: date) }
    scope :recent, -> { order(rate_date: :desc, created_at: :desc) }

    # Get rate from→to for date. Uses base USD: direct if from or to is USD, else two-step.
    # Memoized per request via {ExchangeRates::RateLookupCache}.
    def self.get_rate(from:, to:, date: Date.current)
      RateLookupCache.fetch(from:, to:, date:)
    end

    # Uncached lookup — used by {RateLookupCache} to populate the request store.
    def self.uncached_rate(from:, to:, date: Date.current)
      from = from.to_s.upcase
      to = to.to_s.upcase
      return 1.0 if from == to

      if from == BASE_CURRENCY
        find_by(base_currency: from, target_currency: to, rate_date: date)&.rate
      elsif to == BASE_CURRENCY
        r = find_by(base_currency: BASE_CURRENCY, target_currency: from, rate_date: date)&.rate
        r ? (1.0 / r) : nil
      else
        from_rate = find_by(base_currency: BASE_CURRENCY, target_currency: from, rate_date: date)&.rate
        to_rate = find_by(base_currency: BASE_CURRENCY, target_currency: to, rate_date: date)&.rate
        (from_rate && to_rate) ? (to_rate / from_rate) : nil
      end
    end

    def self.base_targets_for(from:, to:)
      [from, to].map { |currency| currency.to_s.upcase }.uniq - [BASE_CURRENCY]
    end

    def self.cached_for_date?(target:, date:)
      exists?(
        base_currency: BASE_CURRENCY,
        target_currency: target.to_s.upcase,
        rate_date: date
      )
    end

    def self.missing_base_targets_for(from:, to:, date:)
      base_targets_for(from:, to:).reject do |target|
        cached_for_date?(target:, date:)
      end
    end

    # Full daily snapshots from currency-api include hundreds of USD-base targets (~340).
    # Partial on-demand persists only write a small slice for the pair being resolved.
    FULL_SNAPSHOT_MIN_TARGET_COUNT = 250

    def self.cached_target_count_for_date(date:)
      where(base_currency: BASE_CURRENCY, rate_date: date).count
    end

    def self.full_snapshot_for_date?(date:)
      cached_target_count_for_date(date:) >= FULL_SNAPSHOT_MIN_TARGET_COUNT
    end

    def self.sparse_snapshot_for_date?(date:)
      !full_snapshot_for_date?(date:)
    end

    # Most recent rate for from→to (any date). Used when API has no data for requested date.
    def self.get_rate_latest(from:, to:)
      from = from.to_s.upcase
      to = to.to_s.upcase
      return 1.0 if from == to

      if from == BASE_CURRENCY
        recent.find_by(base_currency: from, target_currency: to)&.rate
      elsif to == BASE_CURRENCY
        r = recent.find_by(base_currency: BASE_CURRENCY, target_currency: from)&.rate
        r ? (1.0 / r) : nil
      else
        from_rec = recent.find_by(base_currency: BASE_CURRENCY, target_currency: from)
        to_rec = recent.find_by(base_currency: BASE_CURRENCY, target_currency: to)
        return nil unless from_rec&.rate && to_rec&.rate

        to_rec.rate / from_rec.rate
      end
    end
  end
end
