# frozen_string_literal: true

module Transactions
  module Operations
    module Transfers
      class CalculateBalances < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:transfer_id).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(params)
        end

        include FailureHandler

        def call(params)
          _            = step validate(params:)
          transfer     = step find_transfer(params:)
          return Success(transfer) if transfer.balance_state == "calculated"

          _            = step update_from_account_balance(transfer:)
          _            = step update_to_account_balance(transfer:)
          _            = step update_transfer(transfer:)
        end

        private

        def find_transfer(params:)
          Success(Transactions::Transfer.find(params[:transfer_id]))
        rescue ActiveRecord::RecordNotFound => e
          Failure(transfer_id: "not found", error: e, expected: true)
        end


        def update_from_account_balance(transfer:)
          return Success() if transfer.balance_state == "calculated"

          from_account = transfer.from_account
          # Debit in from-account currency: use original_amount when conversion exists, else amount
          amount_to_debit = transfer.original_amount
          from_new_balance = from_account.balance - amount_to_debit

          from_account.assign_attributes(balance: from_new_balance)
          from_account.save!

          Success(from_account)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(from_account: from_account.errors.to_hash, error: e)
        end

        def update_to_account_balance(transfer:)
          return Success() if transfer.balance_state == "calculated"

          to_account = transfer.to_account
          # Credit in to-account currency: transfer.amount is already in that currency
          to_new_balance = to_account.balance + transfer.amount

          to_account.assign_attributes(balance: to_new_balance)
          to_account.save!

          Success(to_account)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(to_account: to_account.errors.to_hash, error: e)
        end

        def update_transfer(transfer:)
          return Success(transfer) if transfer.balance_state == "calculated"

          transfer.assign_attributes(balance_state: "calculated")

          transfer.save!

          Success(transfer)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(error: e)
        end
      end
    end
  end
end
