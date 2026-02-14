# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module ExchangeRates
  module Operations
    class PersistApiRates < Dry::Operation
      include Dry::Operation::Extensions::ActiveRecord

      BASE_CURRENCY = ExchangeRates::ApiExchangeRate::BASE_CURRENCY

      class Contract < Dry::Validation::Contract
        params do
          required(:rates).value(:hash)
          required(:date).value(:date)
          optional(:base_currency).value(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        synced_count = transaction { step persist(params) }
        synced_count
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        merged = result.to_h
        merged[:base_currency] = merged[:base_currency].presence || BASE_CURRENCY
        Success(merged)
      end

      def persist(params)
        rates = params[:rates]
        date = params[:date]
        base = params[:base_currency]
        synced_count = 0
        rates.each do |target_currency, rate|
          next if target_currency == base

          api_rate = ExchangeRates::ApiExchangeRate.find_or_initialize_by(
            base_currency: base,
            target_currency: target_currency,
            rate_date: date
          )
          api_rate.rate = rate
          api_rate.save!
          synced_count += 1
        end
        Success(synced_count)
      end
    end
  end
end
