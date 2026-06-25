# frozen_string_literal: true

module ExchangeRates
  module Operations
    class FetchRatesFromApi < Dry::Operation
      BASE_CURRENCY = ExchangeRates::ApiExchangeRate::BASE_CURRENCY

      class Contract < Dry::Validation::Contract
        params do
          required(:base_currency).value(:string)
          required(:date).value(:date)
          optional(:target_currencies).value(:array)
        end
      end

      def call(params)
        params = step validate(params:)
        step fetch(params)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def fetch(params)
        base = params[:base_currency]
        date = params[:date]
        targets = Array(params[:target_currencies])
          .map { |currency| currency.to_s.upcase }
          .uniq
          .compact
          .reject(&:blank?)

        if targets.present?
          missing = targets.reject do |target|
            ExchangeRates::ApiExchangeRate.cached_for_date?(target:, date:)
          end
          return Success({}) if missing.blank?

          all_rates = Integrations::ExchangeRates::Client.fetch_rates_from_base(
            base: base,
            date: date
          )
          return Failure(message: "No rates fetched from API") if all_rates.blank?

          return Success(all_rates)
        end

        rates = Integrations::ExchangeRates::Client.fetch_rates_from_base(
          base: base,
          date: date
        )
        return Failure(message: "No rates fetched from API") if rates.blank?

        Success(rates)
      end
    end
  end
end
