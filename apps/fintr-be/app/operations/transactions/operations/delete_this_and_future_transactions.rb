# frozen_string_literal: true

module Transactions
  module Operations
    class DeleteThisAndFutureTransactions < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transaction).filled
          optional(:except_this_transaction).value(:bool)
        end

        rule(:transaction) do
          key.failure("must be a transaction") unless value.is_a?(Transactions::Transaction)
        end
      end

      def call(params)
        params                = step validate(params:)
        future_transactions   = step find_this_and_future_transactions(params:)
        _                     = step end_recurrence_before_cutoff(params:)
        _                     = step delete_this_and_future_transactions(future_transactions:)

        params[:transaction]
      end

      private

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) if contract.failure?

        Success(contract.to_h)
      end

      def find_this_and_future_transactions(params:)
        transaction = params[:transaction]
        transactions = transaction.series_transactions
        transactions = transactions.where("date >= ?", transaction.date)
        transactions = transactions.where.not(id: transaction.id) if params[:except_this_transaction]

        Success(transactions)
      end

      # Destroying later rows is not enough. The earlier occurrence still holds an open
      # IceCube schedule, and the hourly duplicate job materializes the next missing date.
      def end_recurrence_before_cutoff(params:)
        transaction = params[:transaction]
        cutoff = transaction.date.to_date
        root = transaction.root_parent
        survivors = transaction.series_transactions.where("date < ?", cutoff).to_a
        updated = []

        if root.installment? && survivors.any? { |row| row.id == root.id }
          updated << root if shorten_installment_period!(root:, cutoff:)
        end

        survivors.each do |survivor|
          next if root.installment? && survivor.id == root.id

          updated << survivor if cap_open_schedule!(record: survivor, cutoff:)
        end

        broadcast_ended_series_after_commit(records: updated)
        Success(cutoff)
      rescue ActiveRecord::ActiveRecordError => e
        Failure(error: e.message)
      end

      def shorten_installment_period!(root:, cutoff:)
        period = root.installment_period.to_i
        return false if period <= 0

        remaining = (0...period).count do |index|
          (root.date.to_date + index.months) < cutoff
        end
        return false if remaining <= 0

        source_hash =
          if remaining < period
            Utils::Recurrence.schedule(
              repeat_interval: :installment,
              date: root.date,
              installment_period: remaining,
            ).to_hash
          else
            root.schedule
          end
        capped = Utils::Recurrence.cap_schedule_before(
          schedule_hash: source_hash,
          cutoff_date: cutoff,
        )
        attributes = {}
        attributes[:installment_period] = remaining if remaining < period
        attributes[:schedule] = capped if capped.present?
        return false if attributes.empty?

        root.update!(attributes)
        true
      end

      def cap_open_schedule!(record:, cutoff:)
        capped = Utils::Recurrence.cap_schedule_before(
          schedule_hash: record.schedule,
          cutoff_date: cutoff,
        )
        return false if capped.blank?

        record.update!(schedule: capped)
        true
      end

      def broadcast_ended_series_after_commit(records:)
        ended = Array(records).compact.uniq
        return if ended.empty?

        ActiveRecord.after_all_transactions_commit do
          Transactions::Broadcasts::TransactionChange.updated_many(
            transactions: ended,
          )
        end
      end

      def delete_this_and_future_transactions(future_transactions:)
        future_transactions.each do |future_transaction|
          Transactions::Operations::DeleteThisTransaction.new.call(transaction: future_transaction)
        end

        Success(future_transactions)
      end
    end
  end
end
