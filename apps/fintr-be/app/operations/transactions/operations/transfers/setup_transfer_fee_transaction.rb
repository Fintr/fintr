# frozen_string_literal: true

module Transactions
  module Operations
    module Transfers
      class SetupTransferFeeTransaction < Dry::Operation
        class Contract < Dry::Validation::Contract
          TRANSACTION_BALANCE_STATES = Transactions::Transaction.balance_states.values.freeze

          params do
            required(:balance_state).value(:string)
          end

          rule(:balance_state) do
            key.failure("must be 'pending' or 'calculated'") unless TRANSACTION_BALANCE_STATES.include?(value)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(error: contract.errors.to_h) if contract.failure?

          Success(contract.to_h)
        end

        def call(params:, transfer:, fee_category:)
          params          = step validate(params:)
          fee_transaction = step initialize_fee_transaction(params:, transfer:, fee_category:)
          fee_transaction
        end

        private

        def initialize_fee_transaction(params:, transfer:, fee_category:)
          fee_transaction_params = {
            user_id: transfer.user_id,
            space_id: transfer.space_id,
            account_id: transfer.from_account_id,
            category_id: fee_category.id,
            transfer_id: transfer.id,
            amount: transfer.transaction_cost,
            amount_currency: transfer.transaction_cost_currency,
            date: transfer.date,
            description: transfer.fee_transaction_description,
            balance_state: params[:balance_state],
            schedule_type: transfer.schedule_type, # Required for Expense
            balance_cents: 0, # Will be calculated later
            repeat_interval: transfer.repeat_interval,
            repeat_count: transfer.repeat_count
          }

          fee_transaction = Transactions::Expense.new(fee_transaction_params)
          Success(fee_transaction)
        end
      end
    end
  end
end
