# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Transactions
  module Operations
    class DeleteAllInSeriesTransactions < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transaction).filled

          optional(:except_this_transaction).value(:bool)
        end

        rule(:transaction) do
          key.failure("must be a transaction") unless value.is_a?(Transactions::Transaction)
        end
      end

      include Dry::Operation::Extensions::ActiveRecord

      def call(params)
        params                = step validate(params:)
        transaction           = step find_transaction(params:)
        transactions          = step find_transactions(params:)
        _                     = step delete_transactions(ref_transaction: transaction, transactions:, params:)

        transaction
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

      def delete_transactions(ref_transaction:, transactions:, params:)
        transaction do
          transactions.where.not(id: ref_transaction.id).each do |t|
            step Transactions::Operations::DeleteThisTransaction.new.call(transaction: t)
          end

          step Transactions::Operations::DeleteThisTransaction.new.call(transaction: ref_transaction) unless params[:except_this_transaction]
        end

        Success(transactions)
      end
    end
  end
end
