# frozen_string_literal: true

module Transactions
  module Operations
    module Transfers
      class DeleteThisAndFutureTransfers < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:transfer).filled
            optional(:except_this_transfer).value(:bool)
          end

          rule(:transfer) do
            key.failure("must be a transfer") unless value.is_a?(Transactions::Transfer)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) if contract.failure?

          Success(contract.to_h)
        end

        def call(params)
          params              = step validate(params:)
          future_transfers    = step find_this_and_future_transfers(params:)
          deleted_transfers   = step delete_this_and_future_transfers(future_transfers:)

          deleted_transfers
        end

        private

        def find_this_and_future_transfers(params:)
          transfer = params[:transfer]
          transfers = transfer.series_transfers
          transfers = transfers.where("date >= ?", transfer.date)
          transfers = transfers.where.not(id: transfer.id) if params[:except_this_transfer]

          Success(transfers)
        end

        def delete_this_and_future_transfers(future_transfers:)
          future_transfers.each do |future_transfer|
            Transactions::Operations::Transfers::DeleteThisTransfer.new.call(transfer: future_transfer)
          end

          Success(future_transfers)
        end
      end
    end
  end
end
