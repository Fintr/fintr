# frozen_string_literal: true

module Transactions
  module Operations
    class DeleteThisAndFutureTransactions < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transaction).filled
          optional(:except_this_transaction).value(:bool)
        end

        rule(:transaction) do
          key.failure("must be a transaction") unless value.is_a?(Transactions::Transaction)
        end
      end

      def call(params)
        params                = step validate(params:)
        future_transactions   = step find_this_and_future_transactions(params:)
        deleted_transactions  = step delete_this_and_future_transactions(future_transactions:)

        deleted_transactions
      end

      private

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) if contract.failure?

        Success(contract.to_h)
      end

      def find_this_and_future_transactions(params:)
        transaction = params[:transaction]
        transactions = transaction.series_transactions
        transactions = transactions.where("date >= ?", transaction.date)
        transactions = transactions.where.not(id: transaction.id) if params[:except_this_transaction]

        Success(transactions)
      end

      def delete_this_and_future_transactions(future_transactions:)
        future_transactions.each do |future_transaction|
          Transactions::Operations::DeleteThisTransaction.new.call(transaction: future_transaction)
        end

        Success(future_transactions)
      end
    end
  end
end
