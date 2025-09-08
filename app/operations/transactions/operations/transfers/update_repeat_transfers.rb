# frozen_string_literal: true

require "dry/operation/extensions/active_record"
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
        include Dry::Operation::Extensions::ActiveRecord

        def call(params)
          transaction do
            params      = step validate(params:)
            transfer    = step update_transfers(params:)
            transfer
          end
        end

        private


        def update_transfers(params:)
          new_transfer = case params[:update_scope]
          when "this_and_future"
            step update_this_and_future_transfers(params:)
          when "all_in_series"
            step update_all_in_series_transfers(params:)
          else
            Failure(update_scope: "invalid scope")
          end
          Success(new_transfer)
        end

        def update_this_and_future_transfers(params:)
          transfer = params[:transfer]

          new_transfer = case
          when transfer.schedule_type_was == "repeat" && transfer.schedule_type == "one_time"
            step Transactions::Operations::Transfers::DeleteThisAndFutureTransfers.new.call(except_this_transfer: true, **params)
          else
            step Transactions::Operations::Transfers::UpdateThisAndFutureTransfers.new.call(params)
          end

          Success(new_transfer)
        end

        def update_all_in_series_transfers(params:)
          transfer = params[:transfer]

          new_transfer = case
          when transfer.schedule_type_was == "repeat" && transfer.schedule_type == "one_time"
            step Transactions::Operations::Transfers::DeleteAllInSeriesTransfers.new.call(except_this_transfer: true, **params)
          else
            step Transactions::Operations::Transfers::UpdateAllInSeriesTransfers.new.call(params)
          end

          Success(new_transfer)
        end
      end
    end
  end
end
