# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Transactions
  module Operations
    class UpdateAllInSeriesTransactions < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transaction).filled
        end

        rule(:transaction) do
          key.failure("must be a transaction") unless value.is_a?(Transactions::Transaction)
          key.failure("must be a changed transaction") unless value.changed?
        end
      end

      include Dry::Operation::Extensions::ActiveRecord

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) if contract.failure?

        Success(params)
      end

      def call(params)
        transaction do
          params                      = step validate(params:)
          transaction                 = step find_transaction(params:)
          schedule_changed            = step determine_schedule_change(transaction:)
          unless schedule_changed
            other_series_transactions = step find_other_series_transactions(transaction:)
            _                         = step update_all_in_series(transaction:, other_series_transactions:)
            return transaction
          end

          parent_transaction          = step find_parent_transaction(transaction:)
          if transaction.id != parent_transaction.id
            parent_transaction        = step transfer_attributes(parent_transaction:, transaction:)
            _                         = step save_transaction(transaction:)
          else
            parent_transaction        = transaction
          end
          parent_transaction          = step update_this_and_future_transactions(parent_transaction:)

          parent_transaction
        end
      end

      private


      def find_transaction(params:)
        Success(params[:transaction])
      end

      def determine_schedule_change(transaction:)
        schedule_changed = transaction.schedule_type_changed? ||
                           transaction.repeat_interval_changed? ||
                           transaction.installment_period_changed? ||
                           transaction.date_changed?

        Success(schedule_changed)
      end

      def find_parent_transaction(transaction:)
        Success(transaction.root_parent)
      end

      def find_other_series_transactions(transaction:)
        Success(transaction.series_transactions.where.not(id: transaction.id))
      end

      def update_all_in_series(transaction:, other_series_transactions:)
        other_series_transactions.find_each do |other_transaction|
          # Determine appropriate balance_state based on transaction date
          balance_state = other_transaction.date <= Time.zone.today ? "calculated" : "pending"

          other_transaction.assign_attributes(
            amount: transaction.amount,
            category_id: transaction.category_id,
            account_id: transaction.account_id,
            description: transaction.description,
            balance_state: balance_state
            # Note: We intentionally exclude schedule-related fields since we validated they haven't changed
          )

          account_changed = other_transaction.account_id_changed?
          if balance_state == "calculated" && account_changed
            step Transactions::Operations::Accounts::UpdateCalculateBalance.new.call(transaction: other_transaction)
          end
          other_transaction.save!
        end

        Success(other_series_transactions)
      end

      def transfer_attributes(parent_transaction:, transaction:)
        Transactions::Operations::TransferAttributes.new.call(from_record: transaction, to_record: parent_transaction)
      end

      def save_transaction(transaction:)
        transaction.save!
        Success(transaction)
      end

      def update_this_and_future_transactions(parent_transaction:)
        Transactions::Operations::UpdateThisAndFutureTransactions
          .new
          .call(transaction: parent_transaction, all_in_series: true)
      end
    end
  end
end
