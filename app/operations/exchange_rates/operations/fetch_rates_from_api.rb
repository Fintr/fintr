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
        targets = params[:target_currencies]
        rates = if targets.blank?
          Integrations::ExchangeRates::Client.fetch_rates_from_base(
            base: base,
            date: date
          )
        else
          Integrations::ExchangeRates::Client.fetch_rates_for_targets(
            to_currencies: targets,
            base: base,
            date: date
          )
        end
        return Failure(message: "No rates fetched from API") if rates.blank?

        Success(rates)
      end
    end
  end
end
