# frozen_string_literal: true

module ExchangeRates
  # Request-scoped memoization for FX lookups used heavily by insights aggregations.
  class RateLookupCache < ActiveSupport::CurrentAttributes
    attribute :rates

    def self.fetch(from:, to:, date:)
      from = from.to_s.upcase
      to = to.to_s.upcase
      date = date.to_date
      return 1.0 if from == to

      self.rates ||= {}
      key = "#{from}|#{to}|#{date}"
      return self.rates[key] if self.rates.key?(key)

      rate = ApiExchangeRate.uncached_rate(from:, to:, date:)
      self.rates[key] = rate unless rate.nil?
      rate
    end
  end
end
