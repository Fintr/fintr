# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module ExchangeRates
  module Operations
    class SyncApiRates < Dry::Operation
      include Dry::Operation::Extensions::ActiveRecord

      BASE_CURRENCY = ExchangeRates::ApiExchangeRate::BASE_CURRENCY

      class Contract < Dry::Validation::Contract
        params do
          optional(:date).value(:date)
        end
      end

      def call(params = {})
        params = step validate(params:)
        date = params[:date] || Date.current
        rates = step FetchRatesFromApi.new.call(
          base_currency: BASE_CURRENCY,
          date: date
        )
        synced_count = transaction do
          step PersistApiRates.new.call(rates: rates, date: date)
        end
        { synced_count: synced_count, date: date }
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end
    end
  end
end
