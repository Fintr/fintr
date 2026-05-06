# frozen_string_literal: true

module ExchangeRates
  module Operations
    class GetRecentRates < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          required(:from_currency).value(:string)
          required(:to_currency).value(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        from_tx = step fetch_transaction_conversion_rates(params)
        from_transfers = step fetch_transfer_conversion_rates(params)
        step combine_and_limit_rates(
          params:,
          transaction_rates: from_tx,
          transfer_rates: from_transfers
        )
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def fetch_transaction_conversion_rates(params)
        list = ExchangeRates::CurrencyConversion
          .where(space_id: params[:space_id])
          .where(convertible_type: "Transactions::Transaction")
          .where(
            original_currency: params[:from_currency],
            converted_currency: params[:to_currency]
          )
          .select(
            :exchange_rate,
            :rate_timestamp,
            :original_amount_cents,
            :original_currency,
            :converted_amount_cents,
            :converted_currency
          )
          .order(rate_timestamp: :desc)
          .limit(3)
        Success(list.to_a)
      end

      def fetch_transfer_conversion_rates(params)
        list = ExchangeRates::CurrencyConversion
          .where(space_id: params[:space_id])
          .where(convertible_type: "Transactions::Transfer")
          .where(
            original_currency: params[:from_currency],
            converted_currency: params[:to_currency]
          )
          .select(
            :exchange_rate,
            :rate_timestamp,
            :original_amount_cents,
            :original_currency,
            :converted_amount_cents,
            :converted_currency
          )
          .order(rate_timestamp: :desc)
          .limit(3)
        Success(list.to_a)
      end

      def combine_and_limit_rates(params:, transaction_rates:, transfer_rates:)
        from_currency = params[:from_currency]
        to_currency = params[:to_currency]
        combined = (transaction_rates + transfer_rates)
          .sort_by(&:rate_timestamp)
          .reverse
          .take(3)
          .uniq do |c|
            c.multiplier(from_currency:, to_currency:).to_s
          end
          .filter_map do |c|
            m = c.multiplier(from_currency:, to_currency:)
            next if m.nil?

            {
              rate: m.to_f,
              timestamp: c.rate_timestamp,
              source: "recent"
            }
          end
        Success(combined)
      end
    end
  end
end
