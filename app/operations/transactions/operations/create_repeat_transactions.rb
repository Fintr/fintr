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

        dates             = step fetch_dates(params:, transaction:)
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
        params[:date_end] ||= (Time.zone.today + 1.month)
        params[:balance_state] ||= "pending"
        Success(params)
      end

      def determine_proceed(transaction:)
        return Success(false) if transaction.one_time?

        Success(true)
      end

      def fetch_dates(params:, transaction:)
        Transactions::Operations::Schedules::FetchDates.new.call(
          params: {
            record: transaction,
            date_start: params[:date_start],
            date_end: params[:date_end]
          }
        )
      end

      def fetch_last_transaction(params:, transaction:)
        params = { record: transaction, date_end: params[:date_end] }
        Queries::LastRecord.call(params:)
      end

      def bulk_duplicate_transactions(params:, parent_transaction:, last_transaction:, dates:)
        parent_id = parent_transaction.parent_id || parent_transaction.id
        account_balance = parent_transaction.account.balance.amount

        existing_dates = parent_transaction.children.pluck(:date).map(&:to_date)
        dates = dates.reject { |date| existing_dates.include?(date) }

        records = dates.map.with_index do |date, index|
          new_transaction = parent_transaction.amoeba_dup
          new_transaction.schedule = {}
          account_balance += new_transaction.value.amount if params[:balance_state] == "calculated"

          new_transaction.assign_attributes(
            parent_id:,
            date:,
            balance_state: params[:balance_state], # NOTE: Tells the app whether pending or calculated. We assume that transactions in the past were already reflected in current balances.
            balance: account_balance # NOTE: Only update balance if balance_state is calculated
          )
          new_transaction.repeat_count = last_transaction.repeat_count + 1 + index if parent_transaction.repeat?
          new_transaction.installment_count = last_transaction.installment_count + 1 + index if parent_transaction.installment?
          new_transaction
        end

        account = parent_transaction.account
        account.assign_attributes(balance: account_balance)
        account.save!

        Transaction.bulk_import(
          records,
          validate: true,
          validate_uniqueness: true
        )
        Success()
      rescue StandardError => e
        account.invalid? ? Failure(account: account.errors.to_hash, error: e) : Failure(error: e)
      end
    end
  end
end
