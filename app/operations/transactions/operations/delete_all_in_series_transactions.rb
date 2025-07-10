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
        transactions          = step find_transactions(params:)
        deleted_transactions  = step delete_transactions(transactions:)

        deleted_transactions
      end

      private

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) if contract.failure?

        Success(contract.to_h)
      end

      def find_transactions(params:)
        transaction = params[:transaction]
        transaction.series_transactions
      end

      def delete_transactions(transactions:)
        transactions.each do |transaction|
          Transactions::Operations::DeleteThisTransaction.new.call(transaction:)
        end

        Success(transactions)
      end
    end
  end
end
