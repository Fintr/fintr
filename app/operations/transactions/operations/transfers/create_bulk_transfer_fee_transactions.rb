# frozen_string_literal: true

module Transactions
  module Operations
    module Transfers
      class CreateBulkTransferFeeTransactions < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:parent_transfer_id).value(:string)
            required(:dates).value(:array)
            required(:balance_state).value(:string)
          end

          rule(:balance_state) do
            valid_states = Transactions::Transaction.balance_states.values
            key.failure("must be one of: #{valid_states.join(", ")}") unless valid_states.include?(value)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params            = step validate(params:)
          parent_transfer   = step find_parent_transfer(params:)
          return [] if parent_transfer.transaction_cost.zero?

          fee_category      = step find_or_create_transfer_fee_category(parent_transfer:)
          created_transfers = step find_created_transfers(params:, parent_transfer:)
          fee_transactions  = step create_bulk_fee_transactions(
                                   params:,
                                   created_transfers:,
                                   fee_category:,
                                 )
          _                 = step calculate_balances(fee_transactions:, balance_state: params[:balance_state])
          fee_transactions
        end

        private

        def find_parent_transfer(params:)
          transfer = Transactions::Transfer.find(params[:parent_transfer_id])
          Success(transfer)
        rescue ActiveRecord::RecordNotFound => e
          Failure(parent_transfer_id: "not found", error: e)
        end

        def find_or_create_transfer_fee_category(parent_transfer:)
          FindOrCreateTransferFeeCategory.new.call(space_id: parent_transfer.space_id)
        end

        def find_created_transfers(params:, parent_transfer:)
          parent_id = parent_transfer.parent_id || parent_transfer.id
          sorted_dates = params[:dates].sort.map { |date| date.to_date.in_time_zone("Asia/Manila") }
          created_transfers = Transactions::Transfer.where(
            parent_id: parent_id,
            date: sorted_dates.first..sorted_dates.last.end_of_day
          ).order(date: :asc)
          Success(created_transfers)
        end

        def create_bulk_fee_transactions(params:, created_transfers:, fee_category:)
          # Create fee transaction records
          fee_transaction_records = created_transfers.map do |transfer|
            step SetupTransferFeeTransaction.new.call(params:, transfer:, fee_category:)
          end

          # Bulk import fee transactions
          Transactions::Expense.bulk_import(
            fee_transaction_records,
            validate: true,
            validate_uniqueness: true
          )

          Success(fee_transaction_records)
        end

        def calculate_balances(fee_transactions:, balance_state:)
          return Success() unless balance_state == "calculated"

          fee_transactions.each do |fee_transaction|
            Transactions::Operations::Accounts::CalculateBalance.new.call(transaction_id: fee_transaction.id)
          end

          Success()
        end
      end
    end
  end
end
