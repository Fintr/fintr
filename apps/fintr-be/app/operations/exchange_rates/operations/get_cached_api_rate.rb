# frozen_string_literal: true

module ExchangeRates
  module Operations
    class GetCachedApiRate < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:from_currency).value(:string)
          required(:to_currency).value(:string)
          optional(:date).value(:date)
        end
      end

      def call(params)
        params = step validate(params:)
        step lookup(params)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def lookup(params)
        from_currency = params[:from_currency].to_s.upcase
        to_currency = params[:to_currency].to_s.upcase
        date = params[:date] || Date.current
        cached = ExchangeRates::ApiExchangeRate.get_rate(
          from: from_currency,
          to: to_currency,
          date: date
        )
        rate_data = if cached
          {
            rate: cached,
            source: "api",
            from_currency: from_currency,
            to_currency: to_currency,
            timestamp: Time.current
          }
        else
          nil
        end
        Success(rate_data)
      end
    end
  end
end
