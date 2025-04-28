# frozen_string_literal: true

module Transactions
  module Operations
    module Accounts
      class CalculateBalance < Dry::Operation
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

        def call(params:)
          _            = step validate(params:)
          transaction  = step find_transaction(params:)
          account      = step find_account(transaction:)
          _            = step calculate_balance(transaction:, account:)
        end

        def find_transaction(params:)
          Success(Transactions::Transaction.find(params[:transaction_id]))
        rescue ActiveRecord::RecordNotFound => e
          Failure(transaction_id: "not found", error: e)
        end

        def find_account(transaction:)
          Success(transaction.account)
        rescue ActiveRecord::RecordNotFound => e
          Failure(account: "not found", error: e)
        end

        def calculate_balance(transaction:, account:)
          return Success(transaction) if transaction.balance_state == "calculated" # NOTE: Need to be idempotent

          old_balance = account.balance.amount
          balance = old_balance + transaction.value.amount

          account.assign_attributes(balance:)
          transaction.assign_attributes(balance:, balance_state: "calculated")

          account.save!
          transaction.save!
          Success(transaction)
        rescue ActiveRecord::ActiveRecordError => e
          error = "Balance cannot be negative. " \
                "Original balance: #{Utils::Number.format_money(old_balance)}. " \
                "New balance: #{Utils::Number.format_money(balance)}"
        Failure(account_name: error, error:)
        end
      end
    end
  end
end
