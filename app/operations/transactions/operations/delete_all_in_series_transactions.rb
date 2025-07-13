# frozen_string_literal: true

module Transactions
  module Operations
    class DeleteAllInSeriesTransactions < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transaction).filled
        end

        rule(:transaction) do
          key.failure("must be a transaction") unless value.is_a?(Transactions::Transaction)
        end
      end

      def call(params)
        params                = step validate(params:)
        transaction           = step find_transaction(params:)
        transactions          = step find_transactions(params:)
        deleted_transactions  = step delete_transactions(transaction:, transactions:)

        deleted_transactions
      end

      private

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) if contract.failure?

        Success(contract.to_h)
      end

      def find_transaction(params:)
        Success(params[:transaction])
      end

      def find_transactions(params:)
        transaction = params[:transaction]
        Success(transaction.series_transactions)
      end

      def delete_transactions(transaction:, transactions:)
        transactions.where.not(id: transaction.id).each do |t|
          Transactions::Operations::DeleteThisTransaction.new.call(transaction: t)
        end

        Transactions::Operations::DeleteThisTransaction.new.call(transaction:) # NOTE: Delete the reference transaction last.

        Success(transactions)
      end
    end
  end
end
