# frozen_string_literal: true

module ExchangeRates
  module Operations
    # Converts a signed numeric amount from one currency to another using FetchRate
    # (same rate semantics as AmountInSpaceCurrency: amount_to = amount_from * rate).
    # When from and to currency match, returns the rounded amount without calling FetchRate.
    #
    # For transaction balance apply/revert, prefer
    # +Transactions::Operations::Accounts::ResolveSignedBalanceEffect+ so rows with
    # +PersistCurrencyConversion+ metadata use the booked amount instead of a fresh rate.
    class ConvertSignedAmount < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:amount).value(:decimal)
          required(:from_currency).value(:string)
          required(:to_currency).value(:string)
          required(:space_id).value(:string)
          required(:date).value(:date)
        end
      end

      def call(params)
        params = step validate(params:)
        step convert(params:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def convert(params:)
        from_c = params[:from_currency]
        to_c   = params[:to_currency]
        amount = BigDecimal(params[:amount].to_s)

        if from_c == to_c
          return Success(amount: amount.round(2))
        end

        rate_result = ::ExchangeRates::Operations::FetchRate.new.call(
          from_currency: from_c,
          to_currency: to_c,
          space_id: params[:space_id],
          date: params[:date]
        )

        return rate_result if rate_result.failure?

        rate = rate_result.value![:rate]
        converted = (amount * BigDecimal(rate.to_s)).round(2)
        Success(amount: converted)
      end
    end
  end
end
