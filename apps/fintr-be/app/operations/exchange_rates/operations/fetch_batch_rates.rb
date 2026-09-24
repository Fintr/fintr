# frozen_string_literal: true

module ExchangeRates
  module Operations
    class FetchBatchRates < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:requests).array(:hash) do
            required(:from_currency).value(:string)
            required(:to_currency).value(:string)
            optional(:date).value(:date)
          end
          optional(:space_id).value(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        step fetch_rates(params:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def fetch_rates(params:)
        space_id = params[:space_id]
        rates = []
        errors = []

        params[:requests].each do |request|
          from_currency = request[:from_currency].to_s.upcase
          to_currency = request[:to_currency].to_s.upcase
          date = request[:date] || Date.current
          result = FetchRate.new.call(
            from_currency: from_currency,
            to_currency: to_currency,
            space_id: space_id,
            date: date
          )

          if result.success?
            rate_data = result.value!
            rates << rate_data.merge(
              from_currency: from_currency,
              to_currency: to_currency,
              date: date
            )
          else
            errors << {
              from_currency: from_currency,
              to_currency: to_currency,
              date: date,
              message: failure_message(result.failure)
            }
          end
        end

        Success(rates:, errors:)
      end

      def failure_message(failure)
        case failure
        when Hash
          failure[:message] || failure["message"] || failure.to_s
        else
          failure.to_s
        end
      end
    end
  end
end
