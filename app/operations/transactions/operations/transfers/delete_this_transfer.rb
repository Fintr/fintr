# frozen_string_literal: true

module Transactions
  module Operations
    module Transfers
      class DeleteThisTransfer < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:transfer).filled
          end

          rule(:transfer) do
            key.failure("must be a transfer") unless value.is_a?(Transactions::Transfer)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) if contract.failure?

          Success(params)
        end

        def call(params)
          ActiveRecord::Base.transaction do
            params   = step validate(params:)
            transfer = params[:transfer]
            _        = step revert_calculated_balances(transfer:) if transfer.balance_state == "calculated"
            _        = step delete_transfer_fee_transaction(transfer:)
            _        = step delete_transfer(transfer:)
            transfer
          end
        end

        private

        def revert_calculated_balances(transfer:)
          # Revert both account balances if transfer was calculated
          from_account = transfer.from_account
          to_account = transfer.to_account

          # Revert from_account: add back the transfer amount (it was subtracted)
          from_account.balance += transfer.amount
          from_account.save!

          # Revert to_account: subtract the transfer amount (it was added)
          to_account.balance -= transfer.amount
          to_account.save!

          Success([from_account, to_account])
        rescue StandardError => e
          Failure(
            accounts: "failed to revert balances",
            error: e
          )
        end

        def delete_transfer_fee_transaction(transfer:)
          # Find and delete the associated transfer fee transaction if it exists
          fee_transaction = Transactions::Transaction.find_by(transfer_id: transfer.id)
          return Success() unless fee_transaction

          # Use the existing DeleteThisTransaction operation to handle fee transaction deletion
          Transactions::Operations::DeleteThisTransaction.new.call(transaction: fee_transaction)
        rescue StandardError => e
          Failure(
            fee_transaction: "failed to delete transfer fee transaction",
            error: e
          )
        end

        def delete_transfer(transfer:)
          transfer.destroy!
          Success(transfer)
        rescue StandardError => e
          Failure(
            transfer: "failed to delete transfer",
            error: e
          )
        end
      end
    end
  end
end
