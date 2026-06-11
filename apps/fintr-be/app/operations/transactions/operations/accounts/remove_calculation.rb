# frozen_string_literal: true

require "dry/types"

module Transactions
  module Operations
    module Accounts
      class RemoveCalculation < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:transaction_id).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(params)
        end

        include FailureHandler

        def call(params)
          ActiveRecord::Base.transaction do
            _           = step validate(params:)
            transaction = step find_transaction(params:)
            account     = step find_account(transaction:)
            _           = step remove_calculation(transaction:, account:)
          end
        end

        private

        def find_transaction(params:)
          Success(
            Transactions::Transaction.includes(:currency_conversion).find(params[:transaction_id])
          )
        rescue ActiveRecord::RecordNotFound => e
          Failure(transaction_id: "not found", error: e, expected: true)
        end

        def find_account(transaction:)
          Success(transaction.account)
        rescue ActiveRecord::RecordNotFound => e
          Failure(account: "not found", error: e, expected: true)
        end

        def remove_calculation(transaction:, account:)
          # Remove the transaction's amount from the account balance
          return Success(transaction) if transaction.balance_state == "pending" # NOTE: Need to be idempotent

          effect_result = ::Transactions::Operations::Accounts::ResolveSignedBalanceEffect.new.call(
            transaction:,
            account:
          )
          return effect_result unless effect_result.success?

          signed_effect = effect_result.value![:amount]
          old_balance = account.balance.amount
          balance = (
            BigDecimal(old_balance.to_s) - BigDecimal(signed_effect.to_s)
          ).round(2)

          account.assign_attributes(
            balance: Money.from_amount(balance, account.balance_currency)
          )
          transaction.assign_attributes(balance_state: "pending")

          save_result = SaveAccount.new.call(
            account:,
            cause: "transaction_remove_balance",
            whodunnit: transaction.user_id,
            operation: self.class.name
          )
          return save_result if save_result.failure?

          transaction.save!
          Success(transaction)
        rescue ActiveRecord::ActiveRecordError => e
          error = "Balance cannot be negative. " \
                "Original balance: #{Utils::Number.format_money(old_balance)}. " \
                "New balance: #{Utils::Number.format_money(balance)}"
          Failure(account_name: error, error: e)
        end
      end
    end
  end
end
