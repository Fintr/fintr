# frozen_string_literal: true

module Transactions
  module Operations
    module Transfers
      # Persists currency conversion metadata for a transfer (create or update).
      # Delegates to ExchangeRates::Operations::UpsertCurrencyConversion.
      class PersistCurrencyConversion < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:transfer).value(:any)
            optional(:conversion_data).maybe(:hash) do
              optional(:needs_conversion).value(:bool)
              optional(:original_amount).value(:decimal)
              optional(:original_currency).value(:string)
              optional(:converted_amount).value(:decimal)
              optional(:converted_currency).value(:string)
              optional(:exchange_rate).value(:decimal)
              optional(:source).value(:string, included_in?: %w[auto manual recent])
              optional(:rate_timestamp).value(:time)
              optional(:amount).value(:decimal)
              optional(:amount_currency).value(:string)
            end
            optional(:params).maybe(:hash) do
              optional(:original_currency).value(:string)
              optional(:exchange_rate).value(:decimal)
              optional(:exchange_rate_source).value(:string)
              optional(:amount).value(:decimal)
            end
            optional(:from_account).maybe(:any)
            optional(:to_account).maybe(:any)
          end
        end

        # Create flow: pass transfer and conversion_data from handle_currency_conversion.
        # Update flow: pass transfer, params, from_account, and to_account.
        def call(**params)
          validated = step validate(**params)
          transfer = validated[:transfer]
          conversion_data = validated[:conversion_data]
          request_params = validated[:params]
          from_account = validated[:from_account]
          to_account = validated[:to_account]

          if conversion_data.present?
            persist_from_conversion_data(transfer:, conversion_data:)
          elsif request_params.present? && from_account.present? && to_account.present?
            persist_from_params(
              transfer:,
              params: request_params,
              from_account:,
              to_account:
            )
          else
            Success(transfer)
          end
        end

        private

        def validate(**params)
          result = Contract.new.call(**params)
          return Failure(result.errors.to_h) unless result.success?

          Success(result.to_h)
        end

        def persist_from_conversion_data(transfer:, conversion_data:)
          return Success(transfer) unless conversion_data[:needs_conversion]

          step ::ExchangeRates::Operations::UpsertCurrencyConversion.new.call(
            **conversion_data.slice(
              :original_amount,
              :original_currency,
              :converted_amount,
              :converted_currency,
              :exchange_rate,
              :source,
              :rate_timestamp
            ).merge(convertible: transfer, space_id: transfer.space_id)
          )
          Success(transfer)
        end

        def persist_from_params(transfer:, params:, from_account:, to_account:)
          rate = params[:exchange_rate]
          return Success(transfer) if rate.blank?
          return Success(transfer) if from_account.balance_currency == to_account.balance_currency

          converted_amount = params[:amount]
          converted_currency = to_account.balance_currency
          original_currency = from_account.balance_currency
          original_amount = (BigDecimal(converted_amount.to_s) / rate).round(2)
          source = params[:exchange_rate_source].presence || "manual"

          step ::ExchangeRates::Operations::UpsertCurrencyConversion.new.call(
            **{
              convertible: transfer,
              space_id: transfer.space_id,
              original_amount:,
              original_currency:,
              converted_amount:,
              converted_currency:,
              exchange_rate: rate,
              source:
            }
          )
          Success(transfer)
        end
      end
    end
  end
end
