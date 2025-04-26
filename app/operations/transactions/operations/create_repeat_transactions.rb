# frozen_string_literal: true

module Transactions
  module Operations
    class CreateRepeatTransactions < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transaction_id).value(:string)
          optional(:date_start).value(:date)
          optional(:date_end).value(:date)
        end
      end

      def validate(transaction_id:, date_start:, date_end:)
        contract = Contract.new.call(transaction_id:, date_start:, date_end:)
        return Failure(contract.errors.to_h) unless contract.success?

        Success()
      end

      TRANSACTION_ATTRIBUTES = Transaction.clean_attributes.map(&:to_s)

      include FailureHandler

      def call(
        transaction_id:,
        date_start: Time.zone.today,
        date_end: Time.zone.today + 1.month
      )
        _                 = step validate(transaction_id:, date_start:, date_end:)
        transaction       = step find_transaction(transaction_id:)
        proceed           = step determine_proceed(transaction:)
        return Success(nil) unless proceed

        schedule          = step fetch_schedule(transaction:)
        dates             = step fetch_dates(schedule:, date_start:, date_end:)
        last_transaction  = step fetch_last_transaction(transaction:, date_end:)
        transactions      = step bulk_duplicate_transactions(
                                  parent_transaction: transaction,
                                  last_transaction:,
                                  dates:
                                 )
        transactions
      end

      def find_transaction(transaction_id:)
        Success(Transaction.find(transaction_id))
      rescue ActiveRecord::RecordNotFound => e
        Failure(transaction_id: "not found", error: e)
      end

      def determine_proceed(transaction:)
        return Success(false) if transaction.schedule_type == "one_time"

        Success(true)
      end

      def fetch_schedule(transaction:)
        Success(IceCube::Schedule.from_hash(transaction.schedule))
      end

      def fetch_dates(schedule:, date_start:, date_end:)
        dates = schedule.occurrences_between(
          date_start.beginning_of_day,
          date_end.end_of_day
          )
        Success(dates.map { |date| date.utc.to_datetime })
      end

      def fetch_last_transaction(transaction:, date_end:)
        params = { transaction_id: transaction.id, date_end: }
        Queries::LastTransaction.new.call(params:)
      end

      def bulk_duplicate_transactions(parent_transaction:, last_transaction:, dates:)
        parent_id = parent_transaction.parent_id ? parent_transaction.parent_id : parent_transaction.id

        records = dates.map.with_index do |date, index|
          next if parent_transaction.children.where(date:).exists? # NOTE: Need to be idempotent

          new_transaction = parent_transaction.amoeba_dup
          new_transaction.schedule = {}
          new_transaction.assign_attributes(
            parent_id:,
            date:,
            balance_state: "pending" # NOTE: Tells the app that the balance is pending to be calculated
          )
          new_transaction.repeat_count = last_transaction.repeat_count + 1 + index if parent_transaction.repeat?
          new_transaction.installment_count = last_transaction.installment_count + 1 + index if parent_transaction.installment?
          new_transaction
        end

        Transaction.bulk_import(
          records,
          validate: true,
          validate_uniqueness: true
        )
        Success()
      rescue StandardError => e
        Failure(error: e)
      end
    end
  end
end
