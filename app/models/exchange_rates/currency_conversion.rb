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

    # Forward leg +original_currency → +converted_currency+: multiplier +m+ such that
    # +original_money.amount * m ≈ converted_money.amount+ (same sign pattern as
    # {Transactions::Operations::CreateTransaction#prepare_conversion}). Prefer deriving from stored
    # monies so list/edit UI stays correct even if +exchange_rate+ disagrees (wrong convention or
    # drift); otherwise this matches the persisted +exchange_rate+ after upsert / backfill.
    def exchange_rate_as_multiplier
      original_amt = original_money.amount.to_d
      return BigDecimal(exchange_rate.to_s) if original_amt.zero?

      (converted_money.amount.to_d / original_amt).round(10)
    end

    # Directed multiplier for this row only: +from_currency → +to_currency+.
    # Uses {#exchange_rate_as_multiplier} for the stored forward leg; reverse leg is its
    # reciprocal. Returns +nil+ when the pair does not match this row (including +from == to+).
    def multiplier(from_currency:, to_currency:)
      from_c = from_currency.to_s
      to_c = to_currency.to_s
      return nil if from_c == to_c

      unless (from_c == original_currency && to_c == converted_currency) ||
          (from_c == converted_currency && to_c == original_currency)
        return nil
      end

      forward = exchange_rate_as_multiplier
      if from_c == original_currency
        forward
      else
        (BigDecimal("1") / forward).round(10)
      end
    end

    def display_rate
      "#{original_currency} → #{converted_currency} @ #{exchange_rate}"
    end
  end
end
