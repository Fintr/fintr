# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Transactions
  module Operations
    module Transfers
      class DeleteAllInSeriesTransfers < Dry::Operation
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

        include Dry::Operation::Extensions::ActiveRecord

        def call(params)
          params            = step validate(params:)
          transfer          = step find_transfer(params:)
          transfers         = step find_transfers(params:)
          deleted_transfers = step delete_transfers(transfer:, transfers:, params:)

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

        def delete_transfers(transfer:, transfers:, params:)
          transaction do
          transfers.where.not(id: transfer.id).find_each do |t|
            Transactions::Operations::Transfers::DeleteThisTransfer.new.call(transfer: t)
            end

            Transactions::Operations::Transfers::DeleteThisTransfer.new.call(transfer:) unless params[:except_this_transfer]
          end

          Success(transfers)
        end
      end
    end
  end
end
