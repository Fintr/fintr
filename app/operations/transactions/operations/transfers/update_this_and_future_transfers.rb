# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Transactions
  module Operations
    module Transfers
      class UpdateThisAndFutureTransfers < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:transfer)

            optional(:all_in_series).value(:bool)
          end

          rule(:transfer) do
            key.failure("must be a transfer") unless value.is_a?(Transactions::Transfer)
            key.failure("must be a changed transfer") unless value.changed?
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) if contract.failure?

          Success(params)
        end

        include Dry::Operation::Extensions::ActiveRecord

        def call(params)
          transaction do
            params                        = step validate(params:)
            transfer                      = step find_transfer(params:)
            previous_transfers            = step find_previous_transfers(transfer:, params:)
            _                             = step update_effective_parent(transfer:, previous_transfers:)
            _                             = step clear_schedules_from_series(transfer:)
            pending_transfers             = step find_pending_transfers(previous_transfers:)
            _                             = step delete_pending_transfers(pending_transfers:)
            calculated_transfers          = step find_calculated_transfers(previous_transfers:)
            _                             = step delete_calculated_transfers(calculated_transfers:)
            _                             = step recreate_past_to_present_transfers(transfer:)
            _                             = step recreate_future_transfers(transfer:)

            transfer
          end
        end

        private

        def find_transfer(params:)
          Success(params[:transfer])
        end

        def find_previous_transfers(transfer:, params:)
          previous_transfers = transfer.series_transfers.where.not(id: transfer.id)
          previous_transfers = previous_transfers.where(date: transfer.date..) unless params[:all_in_series]

          Success(previous_transfers)
        end

        def update_effective_parent(transfer:, previous_transfers:)
          previous_transfers.update_all(effective_parent_id: transfer.id)

          Success()
        end

        def clear_schedules_from_series(transfer:)
          # Clear schedules from all transfers in the series except the reference transfer
          # This ensures only one transfer per series has a schedule, preventing duplicate job executions
          root_parent = transfer.root_parent

          Transactions::Transfer.where(
            "(parent_id = :root_id OR id = :root_id) AND id != :reference_id",
            root_id: root_parent.id,
            reference_id: transfer.id
          ).update_all(schedule: {})

          Success()
        end

        def find_pending_transfers(previous_transfers:)
          transfers = previous_transfers.where(balance_state: "pending")
          Success(transfers)
        end

        def delete_pending_transfers(pending_transfers:)
          pending_transfers.find_each do |pending_transfer|
            Transactions::Operations::Transfers::DeleteThisTransfer.new.call(transfer: pending_transfer)
          end

          Success()
        end

        def find_calculated_transfers(previous_transfers:)
          transfers = previous_transfers.where(balance_state: "calculated")
          Success(transfers)
        end

        def delete_calculated_transfers(calculated_transfers:)
          calculated_transfers.find_each do |calculated_transfer|
            Transactions::Operations::Transfers::DeleteThisTransfer.new.call(transfer: calculated_transfer)
          end

          Success()
        end

        def recreate_past_to_present_transfers(transfer:)
          return Success() if transfer.one_time?
          return Success() if transfer.date >= Time.zone.today

          CreateRepeatTransfers.new.call(params: {
            transfer:,
            balance_state: "calculated",
            date_start: (transfer.date + 1.day).to_datetime,
            date_end: Time.zone.today
          })
        end

        def recreate_future_transfers(transfer:)
          return Success() if transfer.one_time?

          CreateRepeatTransfers.new.call(params: {
            transfer:,
            balance_state: "pending",
            date_start: Time.zone.tomorrow,
            date_end: Time.zone.today + 1.month
          })
        end
      end
    end
  end
end
