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
    def self.get_rate(from:, to:, date: Date.current)
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

    # Most recent rate for from→to (any date). Used when API has no data for requested date.
    def self.get_rate_latest(from:, to:)
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
