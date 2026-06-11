# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Transactions
  module Operations
    class UpdateThisAndFutureTransactions < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transaction)

          optional(:all_in_series).value(:bool)
        end

        rule(:transaction) do
          key.failure("must be a transaction") unless value.is_a?(Transactions::Transaction)
          key.failure("must be a changed transaction") unless value.changed?
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
          transaction                   = step find_transaction(params:)
          previous_transactions         = step find_previous_transactions(transaction:, params:)
          _                             = step update_effective_parent(transaction:, previous_transactions:)
          _                             = step clear_schedules_from_series(transaction:)
          pending_transactions          = step find_pending_transactions(previous_transactions:)
          _                             = step delete_pending_transactions(pending_transactions:)
          calculated_transactions       = step find_calculated_transactions(previous_transactions:)
          _                             = step delete_calculated_transactions(calculated_transactions:)
          _                             = step recreate_past_to_present_transactions(transaction:)
          _                             = step recreate_future_transactions(transaction:)

          transaction
        end
      end

      def find_transaction(params:)
        Success(params[:transaction])
      end

      def find_previous_transactions(transaction:, params:)
        previous_transactions = transaction.series_records.where.not(id: transaction.id)
        previous_transactions = previous_transactions.where(date: transaction.date..) unless params[:all_in_series]
        Success(previous_transactions)
      end

      def update_effective_parent(transaction:, previous_transactions:)
        previous_transactions.update_all(effective_parent_id: transaction.id)
        Success(previous_transactions)
      end

      def clear_schedules_from_series(transaction:)
        # Clear schedules from all transactions in the series except the reference transaction
        # This ensures only one transaction per series has a schedule, preventing duplicate job executions
        root_parent = transaction.root_parent

        Transactions::Transaction.where(
          "(parent_id = :root_id OR id = :root_id) AND id != :reference_id",
          root_id: root_parent.id,
          reference_id: transaction.id
        ).update_all(schedule: {})

        Success()
      end

      def find_pending_transactions(previous_transactions:)
        Success(previous_transactions.where(balance_state: "pending"))
      end

      def delete_pending_transactions(pending_transactions:)
        pending_transactions.find_each do |pending_transaction|
          Transactions::Operations::DeleteThisTransaction.new.call(transaction: pending_transaction)
        end

        Success(pending_transactions)
      end

      def find_calculated_transactions(previous_transactions:)
        Success(previous_transactions.where(balance_state: "calculated"))
      end

      def delete_calculated_transactions(calculated_transactions:)
        calculated_transactions.find_each do |calculated_transaction|
          Transactions::Operations::DeleteThisTransaction.new.call(transaction: calculated_transaction)
        end

        Success(calculated_transactions)
      end

      def recreate_past_to_present_transactions(transaction:)
        # Create past transactions (from day after transaction until today) with calculated state
        return Success() unless transaction.date < Time.zone.today

        CreateRepeatTransactions.new.call(
          transaction:,
          balance_state: "calculated",
          date_start: (transaction.date + 1.day).beginning_of_day.to_datetime,
          date_end: Time.zone.today
        )
      end

      def recreate_future_transactions(transaction:)
        # Create future transactions (from tomorrow onwards) with pending state
        CreateRepeatTransactions.new.call(
          transaction:,
          balance_state: "pending",
          date_start: Time.zone.tomorrow,
          date_end: Time.zone.today + 1.month
        )
      end
    end
  end
end
