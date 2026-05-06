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
          _           = step delete_rag_embedding(transaction:)
          _           = step delete_transaction(transaction:)

          transaction
        end
      end

      private

      def revert_calculated_balance(transaction:)
        account = transaction.account
        effect_result = ::Transactions::Operations::Accounts::ResolveSignedBalanceEffect.new.call(
          transaction:,
          account:
        )
        return effect_result unless effect_result.success?

        signed_effect = effect_result.value![:amount]
        old_balance = account.balance.amount
        new_balance = (
          BigDecimal(old_balance.to_s) - BigDecimal(signed_effect.to_s)
        ).round(2)
        account.assign_attributes(
          balance: Money.from_amount(new_balance, account.balance_currency)
        )
        account.save!
        Success(account)
      end


      def update_transfer_transaction_cost(transaction:)
        transfer = transaction.transfer
        transfer.transaction_cost = 0
        transfer.save!
        Success(transfer)
      end

      def delete_rag_embedding(transaction:)
        transaction.rag_embedding&.destroy!
        Success(transaction)
      end

      def delete_transaction(transaction:)
        transaction.destroy!
        Success(transaction)
      end
    end
  end
end
