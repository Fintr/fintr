# frozen_string_literal: true

module ExchangeRates
  module Operations
    # Converts an amount from space currency to account currency for storage.
    # Used when the frontend sends amount in space currency and the account uses a different currency.
    # Returns a hash to merge into params: :amount (in account currency) and optionally
    # :original_currency, :exchange_rate, :exchange_rate_source when conversion was performed.
    class SpaceAmountToAccountCurrency < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          optional(:amount).value(:decimal)
          required(:space_currency).value(:string)
          required(:account_currency).value(:string)
          required(:date).value(:date)
          required(:space_id).value(:string)
        end
      end

      def call(params)
        params  = step validate(params:)
        context = step resolve_currencies(params:)
        step apply_conversion(params:, context:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def resolve_currencies(params:)
        space_currency   = params[:space_currency].presence || "PHP"
        account_currency = params[:account_currency].presence || "PHP"
        Success(
          space_currency: space_currency,
          account_currency: account_currency,
          same_currency: (space_currency == account_currency),
          amount_present: params[:amount].present?
        )
      end

      def apply_conversion(params:, context:)
        unless context[:amount_present] && !context[:same_currency]
          return Success({})
        end

        rate_result = step fetch_rate(
          account_currency: context[:account_currency],
          space_currency: context[:space_currency],
          date: params[:date],
          space_id: params[:space_id]
        )
        rate_account_to_space = rate_result[:rate]
        source = rate_result[:source]

        amount_account = (BigDecimal(params[:amount].to_s) / rate_account_to_space).round(2)
        rate_space_to_account = (BigDecimal("1") / rate_account_to_space).round(10)

        Success(
          amount: amount_account,
          original_currency: context[:space_currency],
          exchange_rate: rate_space_to_account,
          exchange_rate_source: source || "manual"
        )
      end

      def fetch_rate(account_currency:, space_currency:, date:, space_id:)
        ::ExchangeRates::Operations::FetchRate.new.call(
          from_currency: account_currency,
          to_currency: space_currency,
          date: date,
          space_id: space_id
        )
      end
    end
  end
end
