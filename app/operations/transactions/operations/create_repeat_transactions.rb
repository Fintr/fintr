# frozen_string_literal: true

module Transactions
  module Operations
    class CreateRepeatTransactions < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transaction_id).value(:string)
          optional(:date_start).value(:date)
          optional(:date_end).value(:date)
          optional(:balance_state).value(:string)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      TRANSACTION_ATTRIBUTES = Transaction.clean_attributes.map(&:to_s)

      include FailureHandler

      def call(params:)
        params            = step validate(params:)
        params            = step add_default_params(params:)
        transaction       = step find_transaction(params:)
        proceed           = step determine_proceed(transaction:)
        return Success(nil) unless proceed

        schedule          = step fetch_schedule(transaction:)
        dates             = step fetch_dates(params:, schedule:)
        last_transaction  = step fetch_last_transaction(params:, transaction:)
        transactions      = step bulk_duplicate_transactions(
                                  params:,
                                  parent_transaction: transaction,
                                  last_transaction:,
                                  dates:
                                 )
        transactions
      end

      def find_transaction(params:)
        Success(Transaction.find(params[:transaction_id]))
      rescue ActiveRecord::RecordNotFound => e
        Failure(transaction_id: "not found", error: e)
      end

      def add_default_params(params:)
        params[:date_start] ||= Time.zone.tomorrow
        params[:date_end] ||= Time.zone.today + 1.month
        params[:balance_state] ||= "pending"
        Success(params)
      end

      def determine_proceed(transaction:)
        return Success(false) if transaction.schedule_type == "one_time"

        Success(true)
      end

      def fetch_schedule(transaction:)
        Success(IceCube::Schedule.from_hash(transaction.schedule))
      end

      def fetch_dates(params:, schedule:)
        dates = schedule.occurrences_between(
          params[:date_start].beginning_of_day,
          params[:date_end].end_of_day
        ).map { |date| date.utc.to_datetime }
        Success(dates)
      end

      def fetch_last_transaction(params:, transaction:)
        params = { transaction_id: transaction.id, date_end: params[:date_end] }
        Queries::LastTransaction.new.call(params:)
      end

      def bulk_duplicate_transactions(params:, parent_transaction:, last_transaction:, dates:)
        parent_id = parent_transaction.parent_id ? parent_transaction.parent_id : parent_transaction.id

        records = dates.map.with_index do |date, index|
          next if parent_transaction.children.where(date:).exists? # NOTE: Need to be idempotent

          new_transaction = parent_transaction.amoeba_dup
          new_transaction.schedule = {}
          new_transaction.assign_attributes(
            parent_id:,
            date:,
            balance_state: params[:balance_state] # NOTE: Tells the app whether pending or calculated. We assume that transactions in the past were already reflected in current balances.
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
