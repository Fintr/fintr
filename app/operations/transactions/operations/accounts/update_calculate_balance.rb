# frozen_string_literal: true

module Transactions
  module Operations
    module Accounts
      class UpdateCalculateBalance < Dry::Operation
        # record has to be a transaction with changes
        class Contract < Dry::Validation::Contract
          params do
            required(:transaction).filled
          end

          rule(:transaction) do
            key.failure("must be a transaction") unless value.is_a?(Transactions::Transaction)
            key.failure("must be a transaction with changes") unless value.changed?
          end
        end


        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          ActiveRecord::Base.transaction do
            params              = step validate(params:)
            transaction         = step dig_transaction(params:)
            previous_account    = step find_account(id: transaction.account_id_was)
            current_account     = step find_account(id: transaction.account_id)
            _                   = step update_balance(from: :previous, transaction:, account: previous_account)
            _                   = step update_balance(from: :current, transaction:, account: current_account)
            transaction
          end
        end

        def dig_transaction(params:)
          Success(params[:transaction])
        end

        def find_account(id:)
          Success(Transactions::Account.find(id))
        rescue ActiveRecord::RecordNotFound => e
          Failure(account: "not found", error: e)
        end

        def update_balance(from:, transaction:, account:)
          case from
          when :previous
            account.balance_cents -= step transaction_amount(transaction:, from:)
          when :current
            account.balance_cents += step transaction_amount(transaction:, from:)
          else
            return Failure(action: "not supported")
          end
          account.save!
          Success(account)
        rescue StandardError => e
          Failure(account: "failed to save", error: e)
        end

        def transaction_amount(transaction:, from:)
          result = if from == :previous
            transaction.is_a?(Transactions::Expense) ? -transaction.amount_cents_was : transaction.amount_cents_was
          else
            transaction.is_a?(Transactions::Expense) ? -transaction.amount_cents : transaction.amount_cents
          end
          Success(result)
        end
      end
    end
  end
end
