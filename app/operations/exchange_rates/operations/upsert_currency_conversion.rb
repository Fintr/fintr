# frozen_string_literal: true

module ExchangeRates
  module Operations
    # Creates or updates the CurrencyConversion record for a convertible (Transaction or Transfer).
    # Use when the frontend has already converted the amount; we only store the exchange-rate metadata.
    class UpsertCurrencyConversion < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:convertible).value(:any)
          required(:space_id).value(:string)
          required(:original_amount).value(:decimal, gt?: 0)
          required(:original_currency).value(:string)
          required(:converted_amount).value(:decimal, gt?: 0)
          required(:converted_currency).value(:string)
          required(:exchange_rate).value(:decimal, gt?: 0)
          required(:source).value(:string, included_in?: %w[auto manual recent])
        end

        rule(:original_currency, :converted_currency) do
          key.failure("cannot be the same as converted_currency") if values[:original_currency] == values[:converted_currency]
        end
      end

      def call(**params)
        rate_timestamp = params.fetch(:rate_timestamp, Time.current)
        validated = step validate(params: params.except(:rate_timestamp))
        step upsert(convertible: validated[:convertible], validated: validated, rate_timestamp: rate_timestamp)
        validated[:convertible]
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) if result.failure?

        Success(result.to_h)
      end

      def upsert(convertible:, validated:, rate_timestamp:)
        original_currency = validated[:original_currency]
        converted_currency = validated[:converted_currency]

        original_subunit =
          Money::Currency
            .new(original_currency)
            .subunit_to_unit

        converted_subunit =
          Money::Currency
            .new(converted_currency)
            .subunit_to_unit

        attrs = {
          original_amount_cents: (
            BigDecimal(validated[:original_amount].to_s) * original_subunit
          ).to_i,
          original_currency: original_currency,
          converted_amount_cents: (
            BigDecimal(validated[:converted_amount].to_s) * converted_subunit
          ).to_i,
          converted_currency: converted_currency,
          exchange_rate: validated[:exchange_rate],
          source: validated[:source],
          rate_timestamp: rate_timestamp
        }
        if convertible.currency_conversion.present?
          convertible.currency_conversion.update!(attrs)
        else
          ExchangeRates::CurrencyConversion.create!(
            convertible:,
            space_id: convertible.space_id,
            **attrs
          )
        end
        Success(convertible)
      rescue ActiveRecord::RecordInvalid => e
        Failure(error: e.message, expected: true)
      end
    end
  end
end
