# frozen_string_literal: true

module Transactions
  module Operations
    module Accounts
      # Signed balance delta in +account.balance_currency+ for applying or reverting a transfer leg,
      # matching {Transactions::Operations::Transfers::CalculateBalances} (debit +original+ on from,
      # credit +converted+ on to).
      #
      # When a +currency_conversion+ exists, booked magnitudes come from persisted monies (same as
      # {ResolveSignedBalanceEffect} for transactions) instead of a fresh +FetchRate+.
      #
      # Otherwise amounts are converted with {ExchangeRates::Operations::ConvertSignedAmount} when
      # +transfer.amount_currency+ differs from the account currency.
      class ResolveSignedTransferBalanceEffect < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:transfer).filled(type?: ::Transactions::Transfer)
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
          transfer = params[:transfer]
          account = params[:account]
          rate_date = params[:rate_date] || rate_date_from_transfer(transfer:)

          if transfer.from_account_id == account.id
            debit_result = debit_magnitude(
              transfer:,
              account:,
              rate_date:
            )
            return debit_result if debit_result.failure?

            Success(amount: -debit_result.value!)
          elsif transfer.to_account_id == account.id
            credit_result = credit_magnitude(
              transfer:,
              account:,
              rate_date:
            )
            return credit_result if credit_result.failure?

            Success(amount: credit_result.value!)
          else
            Failure(account: "does not belong to this transfer")
          end
        end

        def debit_magnitude(transfer:, account:, rate_date:)
          conv = transfer.currency_conversion

          if conv.present?
            if conv.original_currency == account.balance_currency
              return Success(BigDecimal(conv.original_money.amount.to_s).round(2))
            end

            return convert_amount(
              amount: conv.original_money.amount,
              from_currency: conv.original_currency,
              to_currency: account.balance_currency,
              space_id: transfer.space_id,
              date: rate_date
            )
          end

          convert_amount(
            amount: transfer.amount.amount,
            from_currency: transfer.amount_currency,
            to_currency: account.balance_currency,
            space_id: transfer.space_id,
            date: rate_date
          )
        end

        def credit_magnitude(transfer:, account:, rate_date:)
          conv = transfer.currency_conversion

          if conv.present?
            if conv.converted_currency == account.balance_currency
              return Success(BigDecimal(conv.converted_money.amount.to_s).round(2))
            end

            return convert_amount(
              amount: conv.converted_money.amount,
              from_currency: conv.converted_currency,
              to_currency: account.balance_currency,
              space_id: transfer.space_id,
              date: rate_date
            )
          end

          convert_amount(
            amount: transfer.amount.amount,
            from_currency: transfer.amount_currency,
            to_currency: account.balance_currency,
            space_id: transfer.space_id,
            date: rate_date
          )
        end

        def convert_amount(amount:, from_currency:, to_currency:, space_id:, date:)
          out = ::ExchangeRates::Operations::ConvertSignedAmount.new.call(
            amount:,
            from_currency:,
            to_currency:,
            space_id:,
            date:
          )
          return out if out.failure?

          Success(out.value![:amount])
        end

        def rate_date_from_transfer(transfer:)
          d = transfer.date
          d.respond_to?(:to_date) ? d.to_date : d
        end
      end
    end
  end
end
