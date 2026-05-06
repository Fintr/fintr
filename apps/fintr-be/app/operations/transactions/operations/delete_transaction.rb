# frozen_string_literal: true

require "dry/operation/extensions/active_record"
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

      include Dry::Operation::Extensions::ActiveRecord

      def call(params)
        months = nil

        transaction = transaction do
          params      = step validate(params:)
          transaction = step find_transaction(params:)
          months      = step find_affected_months(params:, transaction:)
          _           = step determine_action(params:, transaction:)
          transaction
        end
        _ = step update_monthly_summaries(transaction:, months:)

        transaction
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

      def find_affected_months(params:, transaction:)
        scope = params[:delete_scope]

        relation =
          case scope
          when "this_and_future"
            transaction.series_transactions
                       .where("date >= ?", transaction.date)
          when "all_in_series"
            transaction.series_transactions
          else
            Transactions::Transaction.where(id: transaction.id)
          end

        dates =
          relation
          .distinct
          .pluck(:date)
          .map(&:to_date)

        Success(dates.presence || [transaction.date.to_date])
      end

      def update_monthly_summaries(transaction:, months:)
        months.each do |date|
          MonthlyFinancialSummaries::Operations::UpdateSummary.new.call(
            space_id: transaction.space_id,
            transaction_date: date
          )
        end

        Success()
      end
    end
  end
end
