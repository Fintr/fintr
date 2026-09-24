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
        broadcast_rows = nil
        space_id = nil

        transaction = transaction do
          params         = step validate(params:)
          transaction    = step find_transaction(params:)
          space_id       = transaction.space_id
          broadcast_rows = step snapshot_for_broadcast(params:, transaction:)
          months         = step find_affected_months(params:, transaction:)
          _              = step determine_action(params:, transaction:)
          transaction
        end
        _ = step update_monthly_summaries(transaction:, months:)
        step broadcast_deleted(
          space_id:,
          transactions: broadcast_rows,
          result: transaction,
          params:,
        )
      end

      def find_transaction(params:)
        Success(Transactions::Transaction.find(params[:id]))
      rescue ActiveRecord::RecordNotFound
        Failure(id: "Transaction not found")
      end

      def snapshot_for_broadcast(params:, transaction:)
        relation =
          case params[:delete_scope]
          when "this_and_future"
            transaction.series_transactions.where("date >= ?", transaction.date)
          when "all_in_series"
            transaction.series_transactions
          else
            Transactions::Transaction.where(id: transaction.id)
          end

        # Serialize before destroy — Combined view rows vanish with the records.
        payloads = relation.filter_map do |row|
          Transactions::Broadcasts::TransactionChange.serialize_index_row(
            transaction: row,
          )
        end

        Success(payloads)
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
            transaction_date: date,
          )
        end

        Success()
      end

      def broadcast_deleted(space_id:, transactions:, result:, params:)
        actor = Auth::User.find_by(id: params[:user_id]) || result&.user
        Transactions::Broadcasts::TransactionChange.deleted(
          space_id:,
          transactions:,
          actor:,
        )
        Success(result)
      end
    end
  end
end
