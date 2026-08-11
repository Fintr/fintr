# frozen_string_literal: true

module Transactions
  module Operations
    module Transfers
      # Maps transfer amount + optional FX onto to-account currency and conversion metadata.
      # Shared by create and update. Returns +{ params:, conversion_data: }+.
      class PrepareCurrencyConversion < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:params).value(:hash)
            required(:from_account).value(:any)
            required(:to_account).value(:any)
          end
        end

        def call(**params)
          validated = step validate(**params)
          step prepare(
            params: validated[:params],
            from_account: validated[:from_account],
            to_account: validated[:to_account]
          )
        end

        private

        def validate(**params)
          result = Contract.new.call(**params)
          return Failure(result.errors.to_h) unless result.success?

          Success(result.to_h)
        end

        def prepare(params:, from_account:, to_account:)
          from_currency = from_account.balance_currency
          to_currency = to_account.balance_currency
          original_amount = params[:amount]

          if from_currency == to_currency
            conversion_data = {
              needs_conversion: false,
              original_amount:,
              original_currency: from_currency,
              converted_amount: original_amount,
              converted_currency: from_currency,
              exchange_rate: 1.0,
              rate_timestamp: Time.current
            }
            return Success(
              params: params.merge(amount_currency: from_currency),
              conversion_data:
            )
          end

          rate = params[:exchange_rate]
          request_params = params
          unless rate
            rate_result = step ::ExchangeRates::Operations::FetchRate.new.call(
              from_currency:,
              to_currency:,
              space_id: params[:space_id],
              date: params[:date]
            )
            rate = rate_result[:rate]
            request_params = params.merge(exchange_rate_source: rate_result[:source])
          end

          converted_amount = (BigDecimal(original_amount.to_s) * rate).round(2)
          conversion_data = {
            needs_conversion: true,
            original_amount:,
            original_currency: from_currency,
            converted_amount:,
            converted_currency: to_currency,
            exchange_rate: rate,
            source: request_params[:exchange_rate_source] || "manual",
            rate_timestamp: Time.current
          }
          Success(
            params: request_params.merge(
              amount_currency: to_currency,
              amount: converted_amount
            ),
            conversion_data:
          )
        end
      end
    end
  end
end
