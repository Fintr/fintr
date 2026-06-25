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
        step persist(params)
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
        timestamp = Time.current

        rates.each do |target_currency, rate|
          target = target_currency.to_s.upcase
          next if target == base

          write_rate(
            base: base,
            target_currency: target,
            rate: rate,
            date: date,
            timestamp: timestamp
          )
          synced_count += 1
        end
        Success(synced_count)
      end

      def write_rate(base:, target_currency:, rate:, date:, timestamp:)
        record = ExchangeRates::ApiExchangeRate.find_or_initialize_by(
          base_currency: base,
          target_currency: target_currency,
          rate_date: date
        )
        record.rate = rate
        record.save!
      rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotUnique
        ExchangeRates::ApiExchangeRate
          .find_by!(
            base_currency: base,
            target_currency: target_currency,
            rate_date: date
          )
          .update!(rate: rate, updated_at: timestamp)
      end
    end
  end
end
