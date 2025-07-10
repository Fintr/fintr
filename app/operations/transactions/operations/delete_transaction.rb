# frozen_string_literal: true

module Transactions
  module Operations
    class DeleteTransaction < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:id).filled
          optional(:delete_scope).value(:string)
        end

        rule(:delete_scope) do
          if value.present?
            valid_scopes = ["this_only", "this_and_future", "all_in_series"]
            key.failure("must be one of: #{valid_scopes.join(", ")}") unless valid_scopes.include?(value)
          end
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) if contract.failure?

        Success(params)
      end

      def call(params)
        ActiveRecord::Base.transaction do
          params      = step validate(params:)
          transaction = step find_transaction(params:)
          _           = step determine_action(params:, transaction:)
          transaction
        end
      end

      def find_transaction(params:)
        Success(Transactions::Transaction.find(params[:id]))
      rescue ActiveRecord::RecordNotFound
        Failure(id: "Transaction not found")
      end

      def determine_action(params:, transaction:)
        case params[:delete_scope]
        when "this_only"
          Transactions::Operations::DeleteThisTransaction.new.call(transaction:)
        when "this_and_future"
          Transactions::Operations::DeleteThisAndFutureTransactions.new.call(transaction:)
        when "all_in_series"
          Transactions::Operations::DeleteAllInSeriesTransactions.new.call(transaction:)
        else
          Transactions::Operations::DeleteThisTransaction.new.call(transaction:)
        end
      end
    end
  end
end
