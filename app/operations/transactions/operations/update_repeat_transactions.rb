# frozen_string_literal: true

require "dry/operation/extensions/active_record"
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

      include Dry::Operation::Extensions::ActiveRecord
      include FailureHandler

      def call(params)
        transaction do
          params      = step validate(params:)
          transaction = step update_transactions(params:)
          transaction
        end
      end

      private

      def update_transactions(params:)
        new_transaction = case params[:update_scope]
        when "this_and_future"
          step update_this_and_future_transactions(params:)
        when "all_in_series"
          step update_all_in_series_transactions(params:)
        else
          Failure(update_scope: "invalid scope")
        end
        Success(new_transaction)
      end

      def update_this_and_future_transactions(params:)
        transaction = params[:transaction]

        new_transaction = case
        when transaction.schedule_type_was == "repeat" && transaction.schedule_type == "one_time"
          step Transactions::Operations::DeleteThisAndFutureTransactions.new.call(except_this_transaction: true, **params)
        else
          step Transactions::Operations::UpdateThisAndFutureTransactions.new.call(params)
        end

        Success(new_transaction)
      end

      def update_all_in_series_transactions(params:)
        transaction = params[:transaction]

        new_transaction = case
        when transaction.schedule_type_was == "repeat" && transaction.schedule_type == "one_time"
          step Transactions::Operations::DeleteAllInSeriesTransactions.new.call(except_this_transaction: true, **params)
        else
          step Transactions::Operations::UpdateAllInSeriesTransactions.new.call(params)
        end

        Success(new_transaction)
      end
    end
  end
end
