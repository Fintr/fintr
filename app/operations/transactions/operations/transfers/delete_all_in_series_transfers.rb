# frozen_string_literal: true

module Transactions
  module Operations
    module Transfers
      class DeleteAllInSeriesTransfers < Dry::Operation
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

          Success(contract.to_h)
        end

        def call(params)
          params            = step validate(params:)
          transfer          = step find_transfer(params:)
          transfers         = step find_transfers(params:)
          deleted_transfers = step delete_transfers(transfer:, transfers:)

          deleted_transfers
        end

        private

        def find_transfer(params:)
          Success(params[:transfer])
        end

        def find_transfers(params:)
          transfer = params[:transfer]
          Success(transfer.series_transfers)
        end

        def delete_transfers(transfer:, transfers:)
          transfers.where.not(id: transfer.id).find_each do |t|
            Transactions::Operations::Transfers::DeleteThisTransfer.new.call(transfer: t)
          end

          Transactions::Operations::Transfers::DeleteThisTransfer.new.call(transfer:)

          Success(transfers)
        end
      end
    end
  end
end
