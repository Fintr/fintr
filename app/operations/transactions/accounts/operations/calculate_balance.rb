# frozen_string_literal: true

module Transactions
  module Accounts
    module Operations
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

          balance = account.balance.amount
          balance += transaction.value.amount

          account.assign_attributes(balance:)
          transaction.assign_attributes(balance:, balance_state: "calculated")

          account.save!
          transaction.save!
        rescue ActiveRecord::ActiveRecordError => e
          Failure(account: account.errors.to_hash, transaction: transaction.errors.to_hash, error: e)
        end
      end
    end
  end
end
