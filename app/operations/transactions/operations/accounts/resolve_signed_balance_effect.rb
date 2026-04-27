# frozen_string_literal: true

module Transactions
  module Operations
    module Accounts
      # Signed balance delta in +account.balance_currency+ for applying or reverting a transaction.
      #
      # When +PersistCurrencyConversion+ has stored a +currency_conversion+ for this transaction,
      # +transaction.amount+ is already the booked amount in +converted_currency+ (see
      # +CreateTransaction#transform_params+). We use +transaction.value.amount+ so the effect
      # matches the rate captured at create/update time instead of re-querying +FetchRate+.
      #
      # Otherwise we delegate to +ExchangeRates::Operations::ConvertSignedAmount+ (e.g. legacy rows
      # where +amount_currency+ differs from the account without a conversion record).
      class ResolveSignedBalanceEffect < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:transaction).filled(type?: ::Transactions::Transaction)
            required(:account).filled(type?: ::Transactions::Account)
            optional(:rate_date).value(:date)
          end
        end

        def call(params)
          params = step validate(params:)
          step resolve(params:)
        end

        private

        def validate(params:)
          result = Contract.new.call(**params)
          return Failure(result.errors.to_h) unless result.success?

          Success(result.to_h)
        end

        def resolve(params:)
          transaction = params[:transaction]
          account = params[:account]

          if use_booked_amount_from_persisted_conversion?(transaction:, account:)
            Success(amount: BigDecimal(transaction.value.amount.to_s).round(2))
          else
            rate_date = params[:rate_date] || rate_date_from_transaction(transaction:)
            ::ExchangeRates::Operations::ConvertSignedAmount.new.call(
              amount: transaction.value.amount,
              from_currency: transaction.amount_currency,
              to_currency: account.balance_currency,
              space_id: transaction.space_id,
              date: rate_date
            )
          end
        end

        def use_booked_amount_from_persisted_conversion?(transaction:, account:)
          return false unless transaction.respond_to?(:has_currency_conversion?)

          transaction.has_currency_conversion? &&
            transaction.currency_conversion.converted_currency == account.balance_currency
        end

        def rate_date_from_transaction(transaction:)
          d = transaction.date
          d.respond_to?(:to_date) ? d.to_date : d
        end
      end
    end
  end
end
