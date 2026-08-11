# frozen_string_literal: true

module Transactions
  module Operations
    class CreateRepeatTransactions < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          optional(:transaction_id).value(:string)
          optional(:transaction)
          optional(:date_start).value(:date)
          optional(:date_end).value(:date)
          optional(:balance_state).value(:string)
          optional(:suppress_actor_toast).value(:bool)
        end

        rule(:transaction_id) do
          key.failure("must be supplied if transaction is not") if value.blank? && values[:transaction].blank?
        end

        rule(:transaction) do
          key.failure("must be a transaction") if value.present? && !value.is_a?(Transactions::Transaction)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      TRANSACTION_ATTRIBUTES = Transaction.clean_attributes.map(&:to_s)

      include FailureHandler

      def call(params)
        params            = step validate(params:)
        params            = step add_default_params(params:)
        transaction       = step find_transaction(params:)
        return Success([]) if transaction.one_time?

        dates             = step fetch_dates(params:, transaction:)
        last_transaction  = step fetch_last_transaction(params:, transaction:)
        created           = step bulk_duplicate_transactions(
                                  params:,
                                  parent_transaction: transaction,
                                  last_transaction:,
                                  dates:
                                 )
        step broadcast_created_children(
               created_transactions: created,
               parent_transaction: transaction,
               params:,
             )
        created
      end

      def add_default_params(params:)
        params[:date_start] ||= Time.zone.tomorrow
        params[:date_end] ||= (Time.zone.today + 1.month)
        params[:balance_state] ||= "pending"
        params[:suppress_actor_toast] = false if params[:suppress_actor_toast].nil?
        Success(params)
      end

      def find_transaction(params:)
        transaction = params[:transaction] || Transaction.find(params[:transaction_id])
        Success(transaction)
      rescue ActiveRecord::RecordNotFound => e
        Failure(transaction_id: "not found", error: e, expected: true)
      end

      def fetch_dates(params:, transaction:)
        Transactions::Operations::Schedules::FetchDates.new.call(
          record: transaction,
          date_start: params[:date_start],
          date_end: params[:date_end]
        )
      end

      def fetch_last_transaction(params:, transaction:)
        params = { record: transaction, date_end: params[:date_end] }
        Queries::LastRecord.call(params:)
      end

      def bulk_duplicate_transactions(params:, parent_transaction:, last_transaction:, dates:)
        # Use the effective parent or the transaction itself as the template
        template_transaction = parent_transaction
        parent_id = parent_transaction.parent_id || parent_transaction.id
        account_balance = parent_transaction.account.balance.amount

        # NOTE: We don't want to create transactions for dates that already exist
        existing_dates = parent_transaction.children.pluck(:date).map(&:to_date)
        dates = dates.reject { |date| existing_dates.include?(date) }

        # IMPORTANT: Exclude the parent transaction's date to avoid duplicating the reference transaction
        dates = dates.reject { |date| date.to_date == parent_transaction.date.to_date }

        records = dates.map.with_index do |date, index|
          new_transaction = template_transaction.amoeba_dup
          new_transaction.schedule = {} # NOTE: Duplicates don't have a schedule
          new_transaction.assign_attributes(
            parent_id:,
            effective_parent_id: template_transaction.id,
            date:,
            balance_state: params[:balance_state]
          )
          if params[:balance_state] == "calculated"
            account_for_balance = template_transaction.account
            rate_day = date.respond_to?(:to_date) ? date.to_date : date
            effect_result = ::Transactions::Operations::Accounts::ResolveSignedBalanceEffect.new.call(
              transaction: new_transaction,
              account: account_for_balance,
              rate_date: rate_day
            )
            return effect_result if effect_result.failure?

            account_balance += effect_result.value![:amount]
          end
          new_transaction.assign_attributes(
            balance: account_balance
          )
          new_transaction.repeat_count = (last_transaction&.repeat_count || 1) + 1 + index if parent_transaction.repeat?
          new_transaction.installment_count = (last_transaction&.installment_count || 1) + 1 + index if parent_transaction.installment?
          new_transaction
        end

        # Only update account balance if we're creating new transactions
        if records.any?
          account = parent_transaction.account
          account.assign_attributes(balance: account_balance)
          save_result = ::Transactions::Operations::Accounts::SaveAccount.new.call(
            account:,
            cause: "repeat_transaction_apply_balance",
            whodunnit: parent_transaction.user_id,
            operation: self.class.name
          )
          return save_result if save_result.failure?
        end

        Transaction.bulk_import(
          records,
          validate: true,
          validate_uniqueness: true
        )

        # Prefer the imported records (IDs filled by activerecord-import).
        # Re-querying by date is unreliable across Asia/Manila vs UTC storage.
        if records.any? && template_transaction.files.attached?
          records.each do |record|
            Utils::ActiveStorage.attach_same_blobs_from(
              source_record: template_transaction,
              target_record: record
            )
          end
        end

        Success(records)
      rescue StandardError => e
        account.invalid? ? Failure(account: account.errors.to_hash, error: e) : Failure(error: e)
      end

      def broadcast_created_children(created_transactions:, parent_transaction:, params:)
        Transactions::Broadcasts::TransactionChange.created_many(
          transactions: Array(created_transactions),
          actor: parent_transaction.user,
          suppress_actor_toast: params[:suppress_actor_toast],
        )

        Success(created_transactions)
      end
    end
  end
end
