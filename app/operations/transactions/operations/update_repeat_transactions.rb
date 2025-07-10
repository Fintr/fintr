# frozen_string_literal: true

module Transactions
  module Operations
    class UpdateRepeatTransactions < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transaction).filled
          required(:update_scope).value(:string)
        end

        rule(:update_scope) do
          valid_scopes = ["this_and_future", "all_in_series"]
          key.failure("must be one of: #{valid_scopes.join(", ")}") unless valid_scopes.include?(value)
        end

        rule(:transaction) do
          key.failure("must be a transaction") unless value.is_a?(Transactions::Transaction)
          key.failure("must be a changed transaction") unless value.changed?
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
          params      = step validate(params:)
          _           = step validate_schedule_changes(params:)
          _           = step update_transactions(params:)
        end
      end

      private

      def validate_schedule_changes(params:)
        return Success() unless params[:update_scope] == "all_in_series"

        transaction = params[:transaction]

        # Check if schedule-related fields have changed
        schedule_changed = transaction.schedule_type_changed? ||
                          transaction.repeat_interval_changed? ||
                          transaction.installment_period_changed?

        return Success() unless schedule_changed

        Failure(schedule: "Cannot change schedule settings when updating all transactions in series. Use 'this_and_future' instead.")
      end

      def update_transactions(params:)
        affected_transactions = case params[:update_scope]
        when "this_and_future"
          step update_this_and_future_transactions(params:)
        when "all_in_series"
          step Transactions::Operations::UpdateAllInSeriesTransactions.new.call(params)
        else
          Failure(update_scope: "invalid scope")
        end
        Success(affected_transactions)
      end

      def update_this_and_future_transactions(params:)
        transaction = params[:transaction]

        future_transactions = case
        when transaction.schedule_type_was == "repeat" && transaction.schedule_type == "one_time"
          step Transactions::Operations::DeleteThisAndFutureTransactions.new.call(except_this_transaction: true, **params)
        else
          step Transactions::Operations::UpdateThisAndFutureTransactions.new.call(params)
        end

        Success(future_transactions)
      end
    end
  end
end
