# frozen_string_literal: true

module Transactions
  module Operations
    module Accounts
      class ComputeBalanceTotals < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:accounts).value(:array)
            required(:space).value(:any)
          end

          rule(:space) do
            key.failure("should be a space") unless values[:space].is_a?(Spaces::Space)
          end
        end

        def call(params)
          params = step validate(params:)
          step sum_totals(params:)
        end

        private

        def validate(params:)
          result = Contract.new.call(**params)
          return Failure(result.errors.to_h) unless result.success?

          Success(result.to_h)
        end

        def sum_totals(params:)
          accounts       = params[:accounts]
          space          = params[:space]
          space_currency = space.currency.presence || "PHP"
          today          = Date.current

          total         = BigDecimal("0")
          cash_total    = BigDecimal("0")
          payable_total = BigDecimal("0")

          accounts.each do |account|
            amount = amount_in_space_currency(account:, space:, date: today)
            total += amount

            if Transactions::Account.cash_total_category?(account.account_category)
              cash_total += amount
            elsif Transactions::Account.payable_total_category?(account.account_category)
              payable_total += amount
            end
          end

          Success(
            total: total.round(2).to_f,
            cash_total: cash_total.round(2).to_f,
            payable_total: payable_total.round(2).to_f,
            currency: space_currency
          )
        end

        def amount_in_space_currency(account:, space:, date:)
          result = ::ExchangeRates::Operations::AmountInSpaceCurrency.new.call(
            amount: account.balance.amount,
            amount_currency: account.balance_currency,
            date: date,
            space: space,
            strict: false
          )

          return BigDecimal("0") unless result.success?

          result.value![:amount].to_d
        end
      end
    end
  end
end
