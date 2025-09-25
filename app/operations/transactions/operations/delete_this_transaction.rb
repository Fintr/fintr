# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Transactions
  module Operations
    class DeleteThisTransaction < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transaction).filled
        end

        rule(:transaction) do
          key.failure("must be a transaction") unless value.is_a?(Transactions::Transaction)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) if contract.failure?

        Success(params)
      end

      include Dry::Operation::Extensions::ActiveRecord

      def call(params)
        ActiveRecord::Base.transaction do
          params      = step validate(params:)
          transaction = params[:transaction]
          _           = step revert_calculated_balance(transaction:) if transaction.balance_state == "calculated"
          _           = step update_transfer_transaction_cost(transaction:) if transaction.transfer
          _           = step delete_transaction(transaction:)

          transaction
        end
      end

      private

      def revert_calculated_balance(transaction:)
        account = transaction.account
        account.balance -= transaction.value
        account.save!
        Success(account)
      end


      def update_transfer_transaction_cost(transaction:)
        transfer = transaction.transfer
        transfer.transaction_cost = 0
        transfer.save!
        Success(transfer)
      end

      def delete_transaction(transaction:)
        transaction.destroy!
        Success(transaction)
      end
    end
  end
end
