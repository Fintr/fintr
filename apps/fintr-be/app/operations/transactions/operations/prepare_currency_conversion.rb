# frozen_string_literal: true

module Transactions
  module Operations
    # Maps incoming +amount+ (+ optional FX / amount_in_currency) onto booked account currency
    # and conversion metadata for PersistCurrencyConversion. Shared by create and update.
    class PrepareCurrencyConversion < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:params).value(:hash)
          required(:account).value(:any)
        end
      end

      def call(**params)
        validated = step validate(**params)
        step prepare(
          params: validated[:params],
          account: validated[:account]
        )
      end

      private

      def validate(**params)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      # When frontend sends original_currency + exchange_rate, amount is in original currency; convert to account.
      # When initial_balance is true (e.g. new account), amount is already in account currency; no conversion.
      # When amount_in_currency matches the account currency, amount is already in account currency; no conversion.
      # When amount_in_currency matches the space currency (or is omitted), amount is treated as space currency
      # and converted to the account when account currency differs from the space.
      def prepare(params:, account:)
        space = account.space
        space_currency = space.currency.presence || "PHP"
        account_currency = account.balance_currency.presence || "PHP"
        amount_param = params[:amount]

        if params[:initial_balance]
          return book_amount_without_fx(amount_param:, account_currency:)
        end

        if params[:original_currency].present? && params[:exchange_rate].present?
          if params[:original_currency].to_s == account_currency.to_s
            return book_amount_without_fx(amount_param:, account_currency:)
          end

          original_amount = BigDecimal(amount_param.to_s)
          exchange_rate = BigDecimal(params[:exchange_rate].to_s)
          converted_amount = (original_amount * exchange_rate).round(2)
          source = params[:exchange_rate_source].presence || "manual"

          return Success(
            needs_conversion: true,
            original_amount: original_amount.to_f,
            original_currency: params[:original_currency],
            converted_amount: converted_amount.to_f,
            converted_currency: account_currency,
            exchange_rate: exchange_rate.to_f,
            source: source,
            rate_timestamp: Time.current
          )
        end

        if params[:amount_in_currency].present?
          incoming = normalize_currency_code(params[:amount_in_currency])
          allowed_account = normalize_currency_code(account_currency)
          allowed_space = normalize_currency_code(space_currency)

          unless incoming == allowed_account || incoming == allowed_space
            return Failure(
              amount_in_currency: [
                "must match the account currency (#{account_currency}) or the space currency (#{space_currency})"
              ]
            )
          end

          if incoming == allowed_account
            return book_amount_without_fx(amount_param:, account_currency:)
          end
        end

        if account_currency == space_currency
          return book_amount_without_fx(amount_param:, account_currency:)
        end

        # Rate: 1 account unit = rate space units. So amount_in_space = amount_account * rate => amount_account = amount_in_space / rate.
        rate_result = step ::ExchangeRates::Operations::FetchRate.new.call(
          from_currency: account_currency,
          to_currency: space_currency,
          space_id: params[:space_id],
          date: params[:date]
        )
        rate_account_to_space = rate_result[:rate]
        raw_source = rate_result[:source]
        source = raw_source.presence_in(%w[auto manual recent]) || "manual"
        amount_account = (BigDecimal(amount_param.to_s) / rate_account_to_space).round(2)
        rate_space_to_account = (BigDecimal("1") / rate_account_to_space).round(10)

        Success(
          needs_conversion: true,
          original_amount: amount_param.to_f,
          original_currency: space_currency,
          converted_amount: amount_account.to_f,
          converted_currency: account_currency,
          exchange_rate: rate_space_to_account.to_f,
          source: source,
          rate_timestamp: Time.current
        )
      end

      def book_amount_without_fx(amount_param:, account_currency:)
        Success(
          needs_conversion: false,
          amount: amount_param,
          amount_currency: account_currency
        )
      end

      def normalize_currency_code(code)
        code.to_s.strip.upcase
      end
    end
  end
end
