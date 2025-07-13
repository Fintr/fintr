# frozen_string_literal: true

module Transactions
  module Operations
    class UpdateThisAndFutureTransactions < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transaction)
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

      def call(params)
        params                        = step validate(params:)
        transaction                   = step find_transaction(params:)
        previous_transactions         = step find_previous_transactions(transaction:)
        _                             = step update_effective_parent(transaction:, previous_transactions:)
        _                             = step clear_schedules_from_series(transaction:)
        pending_transactions          = step find_pending_transactions(previous_transactions:)
        _                             = step delete_pending_transactions(pending_transactions:)
        calculated_transactions       = step find_calculated_transactions(previous_transactions:)
        _                             = step delete_calculated_transactions(calculated_transactions:)
        _                             = step recreate_past_to_present_transactions(transaction:)
        _                             = step recreate_future_transactions(transaction:)

        previous_transactions
      end

      def find_transaction(params:)
        Success(params[:transaction])
      end

      # NOTE: Previous transactions can be in the past, present, or future, but definitely
      # the future of the reference transaction.
      def find_previous_transactions(transaction:)
        # Find all transactions in the series that are from tomorrow onwards
        # Use series_records to ensure we get all transactions in the series
        previous_transactions = transaction.series_records.where("date >= ? AND id != ?",
                                                                transaction.date,
                                                                transaction.id)

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
        pending_transactions.delete_all
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
