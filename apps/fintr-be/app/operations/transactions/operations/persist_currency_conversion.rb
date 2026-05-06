# frozen_string_literal: true

module Transactions
  module Operations
    # Persists currency conversion metadata for a transaction (create or update).
    # Delegates to ExchangeRates::Operations::UpsertCurrencyConversion.
    class PersistCurrencyConversion < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transaction).value(:any)
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
          optional(:account).maybe(:any)
        end
      end

      # Create flow: pass transaction and conversion_data from prepare_conversion.
      # Update flow: pass transaction, params, and account (conversion fields derived from params).
      def call(**params)
        validated = step validate(**params)
        transaction = validated[:transaction]
        conversion_data = validated[:conversion_data]
        request_params = validated[:params]
        account = validated[:account]

        if conversion_data.present?
          persist_from_conversion_data(transaction:, conversion_data:)
        elsif request_params.present? && account.present?
          persist_from_params(transaction:, params: request_params, account:)
        else
          transaction
        end
      end

      private

      def validate(**params)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def persist_from_conversion_data(transaction:, conversion_data:)
        return Success(transaction) unless conversion_data[:needs_conversion]

        result = ::ExchangeRates::Operations::UpsertCurrencyConversion.new.call(
          **conversion_data.slice(
            :original_amount,
            :original_currency,
            :converted_amount,
            :converted_currency,
            :exchange_rate,
            :source,
            :rate_timestamp
          ).merge(convertible: transaction, space_id: transaction.space_id)
        )
        if result.failure? && result.failure[:original_currency] == ["cannot be the same as converted_currency"]
          Success(transaction)
        elsif result.failure?
          result
        else
          Success(transaction)
        end
      end

      def persist_from_params(transaction:, params:, account:)
        original_currency = params[:original_currency]
        rate = params[:exchange_rate]
        return Success(transaction) if original_currency.blank? || rate.blank?
        return Success(transaction) if original_currency == account.balance_currency

        converted_amount = params[:amount]
        converted_currency = account.balance_currency
        original_amount = (BigDecimal(converted_amount.to_s) / rate).round(2)
        source = params[:exchange_rate_source].presence || "manual"

        step ::ExchangeRates::Operations::UpsertCurrencyConversion.new.call(
          **{
            convertible: transaction,
            space_id: transaction.space_id,
            original_amount:,
            original_currency:,
            converted_amount:,
            converted_currency:,
            exchange_rate: rate,
            source:
          }
        )
        Success(transaction)
      end
    end
  end
end
