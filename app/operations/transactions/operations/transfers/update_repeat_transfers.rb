# frozen_string_literal: true

module Transactions
  module Operations
    module Transfers
      class UpdateRepeatTransfers < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:transfer).filled
            required(:update_scope).value(:string)
          end

          rule(:update_scope) do
            valid_scopes = ["this_and_future", "all_in_series"]
            key.failure("must be one of: #{valid_scopes.join(", ")}") unless valid_scopes.include?(value)
          end

          rule(:transfer) do
            key.failure("must be a transfer") unless value.is_a?(Transactions::Transfer)
            key.failure("must be a changed transfer") unless value.changed?
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          ActiveRecord::Base.transaction do
            params = step validate(params:)
            _      = step validate_schedule_changes(params:)
            _      = step update_transfers(params:)
          end
        end

        private

        def validate_schedule_changes(params:)
          return Success() unless params[:update_scope] == "all_in_series"

          transfer = params[:transfer]

          # Check if schedule-related fields have changed
          schedule_changed = transfer.schedule_type_changed? ||
                            transfer.repeat_interval_changed?

          return Success() unless schedule_changed

          Failure(schedule: "Cannot change schedule settings when updating all transfers in series. Use 'this_and_future' instead.")
        end

        def update_transfers(params:)
          affected_transfers = case params[:update_scope]
          when "this_and_future"
            step update_this_and_future_transfers(params:)
          when "all_in_series"
            step Transactions::Operations::Transfers::UpdateAllInSeriesTransfers.new.call(params)
          else
            Failure(update_scope: "invalid scope")
          end
          Success(affected_transfers)
        end

        def update_this_and_future_transfers(params:)
          transfer = params[:transfer]

          future_transfers = case
          when transfer.schedule_type_was == "repeat" && transfer.schedule_type == "one_time"
            step Transactions::Operations::Transfers::DeleteThisAndFutureTransfers.new.call(except_this_transfer: true, **params)
          else
            step Transactions::Operations::Transfers::UpdateThisAndFutureTransfers.new.call(params)
          end

          Success(future_transfers)
        end
      end
    end
  end
end
