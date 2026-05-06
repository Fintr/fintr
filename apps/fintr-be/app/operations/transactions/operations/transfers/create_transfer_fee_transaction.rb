# frozen_string_literal: true

module Transactions
  module Operations
    module Transfers
      class CreateTransferFeeTransaction < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:transfer_id).value(:string)
            required(:user_id).value(:string)
            required(:space_id).value(:string)
            required(:transaction_cost).value(:decimal, gteq?: 0)
            required(:transaction_cost_currency).value(:string)
            required(:date).value(:date)
            optional(:description).value(:string)
            optional(:balance_state).value(:string)
          end

          rule(:transaction_cost) do
            key.failure("must be greater than 0") unless value > 0
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params          = step validate(params:)
          transfer        = step find_transfer(params:)
          fee_category    = step find_or_create_transfer_fee_category(params:)
          fee_transaction = step create_fee_transaction(params:, transfer:, fee_category:)
          _               = step calculate_balance(fee_transaction:)
          fee_transaction
        end

        private

        def find_transfer(params:)
          transfer = Transactions::Transfer.find(params[:transfer_id])
          Success(transfer)
        rescue ActiveRecord::RecordNotFound => e
          Failure(transfer_id: "not found", error: e, expected: true)
        end

        def find_or_create_transfer_fee_category(params:)
          FindOrCreateTransferFeeCategory.new.call(params)
        end

        def create_fee_transaction(params:, transfer:, fee_category:)
          fee_transaction = step SetupTransferFeeTransaction.new.call(params:, transfer:, fee_category:)
          fee_transaction.save!
          Success(fee_transaction)
        rescue StandardError => e
          Failure(fee_transaction: fee_transaction&.errors&.to_hash, error: e)
        end

        def calculate_balance(fee_transaction:)
          # This is calculated.
          Transactions::Operations::Accounts::CalculateBalance.new.call(transaction_id: fee_transaction.id)
        end
      end
    end
  end
end
