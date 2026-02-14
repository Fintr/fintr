# frozen_string_literal: true

module ExchangeRates
  class CurrencyConversion < ApplicationRecord
    self.table_name = "currency_conversions"

    belongs_to :convertible, polymorphic: true
    belongs_to :space, class_name: "Spaces::Space"

    monetize :original_amount_cents, with_model_currency: :original_currency
    monetize :converted_amount_cents, with_model_currency: :converted_currency

    validates :space_id, :original_currency, :converted_currency, :exchange_rate, :source, presence: true
    validates :exchange_rate, numericality: { greater_than: 0 }
    validates :source, inclusion: { in: %w[auto manual recent] }
    validates :original_currency,
      exclusion: {
        in: ->(record) { [record.converted_currency] },
        message: "cannot be the same as converted_currency"
      }
    validates :convertible_id, uniqueness: { scope: :convertible_type }

    def original_money
      Money.new(original_amount_cents, original_currency)
    end

    def converted_money
      Money.new(converted_amount_cents, converted_currency)
    end

    def display_rate
      "#{original_currency} → #{converted_currency} @ #{exchange_rate}"
    end
  end
end
