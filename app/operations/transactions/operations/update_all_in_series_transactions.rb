# frozen_string_literal: true

module Transactions
  module Operations
    class UpdateAllInSeriesTransactions < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transaction).filled
        end

        rule(:transaction) do
          key.failure("must be a transaction") unless value.is_a?(Transactions::Transaction)
          key.failure("must be a changed transaction") unless value.changed?
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) if contract.failure?

        Success(params)
      end


      def call(params)
        params                    = step validate(params:)
        transaction               = step find_transaction(params:)
        other_series_transactions = step find_other_series_transactions(transaction:)
        _                         = step update_all_in_series(transaction:, other_series_transactions:)

        Success(params)
      end

      private


      def find_transaction(params:)
        Success(params[:transaction])
      end

      def find_other_series_transactions(transaction:)
        Success(transaction.series_transactions.where.not(id: transaction.id))
      end

      def update_all_in_series(transaction:, other_series_transactions:)
        other_series_transactions.find_each do |other_transaction|
          # Determine appropriate balance_state based on transaction date
          balance_state = other_transaction.date <= Time.zone.today ? "calculated" : "pending"

          other_transaction.assign_attributes(
            amount: transaction.amount,
            category_id: transaction.category_id,
            account_id: transaction.account_id,
            description: transaction.description,
            balance_state: balance_state
            # Note: We intentionally exclude schedule-related fields since we validated they haven't changed
          )
          step Transactions::Operations::Accounts::UpdateCalculateBalance.new.call(transaction: other_transaction)
          other_transaction.save!
        end

        Success(other_series_transactions)
      end
    end
  end
end
