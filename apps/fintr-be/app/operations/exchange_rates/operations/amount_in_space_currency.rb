# frozen_string_literal: true

module ExchangeRates
  module Operations
    # Returns the numeric amount and currency when expressing a given amount in the space's currency.
    # Used so the frontend can read a single "display amount" (always in space currency).
    # For past data, uses rate at the given date (FetchRate will use cache or fetch from API and persist).
    #
    # When +strict: true+, cross-currency rows require a successful rate; otherwise +Failure+ (for
    # aggregations that must not mix foreign units into space-currency totals). When +strict+ is
    # false (default), a missing rate falls back to the booked amount and native currency.
    class AmountInSpaceCurrency < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:amount).value(:decimal)
          required(:amount_currency).value(:string)
          required(:date).value(:date)
          required(:space).value(:any)
          optional(:strict).maybe(:bool)
        end
      end

      def call(params)
        params   = step validate(params:)
        context  = step resolve_currencies(params:)
        step compute_display_amount(params:, context:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def resolve_currencies(params:)
        space_currency = params[:space].currency.presence || "PHP"
        from_currency  = params[:amount_currency].presence || "PHP"
        Success(
          space_currency: space_currency,
          from_currency: from_currency,
          same_currency: (from_currency == space_currency)
        )
      end

      def compute_display_amount(params:, context:)
        strict = params[:strict] == true

        if context[:same_currency]
          return Success(
            amount: params[:amount].to_d.round(2),
            currency: context[:space_currency]
          )
        end

        rate_result = ::ExchangeRates::Operations::FetchRate.new.call(
          from_currency: context[:from_currency],
          to_currency: context[:space_currency],
          date: params[:date],
          space_id: params[:space].id
        )

        unless rate_result.success?
          return Failure(
            rate: "unavailable",
            from_currency: context[:from_currency],
            to_currency: context[:space_currency],
            message: rate_result.failure
          ) if strict

          return Success(
            amount: params[:amount].to_d.round(2),
            currency: context[:from_currency]
          )
        end

        rate = rate_result.value![:rate]
        converted = (params[:amount].to_d * rate).round(2)
        Success(amount: converted, currency: context[:space_currency])
      end
    end
  end
end
