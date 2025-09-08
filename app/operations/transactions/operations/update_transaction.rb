# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Transactions
  module Operations
    class UpdateTransaction < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:id).value(:string)
          optional(:update_scope).value(:string)
          optional(:file)
        end

        rule(:update_scope) do
          if value.present?
            valid_scopes = ["this_only", "this_and_future", "all_in_series"]
            key.failure("must be one of: #{valid_scopes.join(", ")}") unless valid_scopes.include?(value)
          end
        end
      end

      def validate(params:)
        contract_id = Contract.new.call(**params)
        return Failure(contract_id.errors.to_h) if contract_id.failure?

        contract_other_params = Transactions::Operations::CreateTransaction::Contract.new.call(**params)
        return Failure(contract_other_params.errors.to_h) if contract_other_params.failure?

        Success(contract_id.to_h.merge(contract_other_params.to_h))
      end

      include FailureHandler
      include Dry::Operation::Extensions::ActiveRecord

      def call(params)
        transaction = transaction do
          params              = step validate(params:)
          transaction         = step find_transaction(params:)
          category            = step find_category(params:)
          account             = step find_account(params:)
          params              = step transform_params(params:, category:, account:)
          changed_transaction = step initialize_update_transaction(transaction:, params:)
          _                   = step validate_installment_not_changed(transaction: changed_transaction)
          _                   = step adjust_balance(transaction: changed_transaction)
          changed_transaction = step update_schedule(transaction: changed_transaction, params:)
          new_transaction     = step update_repeat_transactions(transaction: changed_transaction, params:)
          saved_transaction   = step save_transaction(transaction: new_transaction)
          saved_transaction
        end
        _ = step attach_file(transaction:, params:) # NOTE: ActiveStorage doesn't save the file if inside a transaction block.
        transaction.reload
      end

      private

      def find_transaction(params:)
        transaction = Transaction.find(params[:id])
        Success(transaction)
      rescue ActiveRecord::RecordNotFound
        Failure(id: "transaction not found")
      end

      def find_category(params:)
        category = Transactions::Category.find_by!(name: params[:category_name], space_id: params[:space_id])
        Success(category)
      rescue ActiveRecord::RecordNotFound
        Failure(category_name: "not found")
      end

      def find_account(params:)
        account = Transactions::Account.kept.find_by!(name: params[:account_name], space_id: params[:space_id])
        Success(account)
      rescue ActiveRecord::RecordNotFound
        Failure(account_name: "not found")
      end

      def transform_params(params:, category:, account:)
        params = params.dup
        params[:category_id] = category.id
        params[:account_id] = account.id
        params[:amount_currency] = "PHP"
        params[:balance_currency] = "PHP"
        params[:balance_cents] = 0 # NOTE: Balance is calculated in the adjust_balance method
        params[:repeat_count] ||= 1 if params[:schedule_type] == "repeat"
        params[:installment_count] ||= 1 if params[:schedule_type] == "installment"
        params.delete(:category_name)
        params.delete(:account_name)
        Success(params)
      end


      def initialize_update_transaction(transaction:, params:)
        transaction.assign_attributes(**params.except(:id, :update_scope, :file))
        Success(transaction)
      end

      def validate_installment_not_changed(transaction:)
        if transaction.schedule_type_was == :installment && transaction.schedule_type != :installment
          return Failure(schedule_type: "cannot change from installment")
        end

        if transaction.schedule_type == :installment && transaction.schedule_type_was != :installment
          return Failure(schedule_type: "cannot change to installment")
        end

        Success()
      end

      def adjust_balance(transaction:)
        return Success(transaction) unless transaction.changed? && transaction.balance_state == "calculated"

        Transactions::Operations::Accounts::UpdateCalculateBalance.new.call(transaction:)
      end

      def update_schedule(transaction:, params:)
        # Always create schedule for "this_and_future" updates to ensure proper job execution
        force_schedule_creation = params[:update_scope] == "this_and_future"

        return Success(transaction) unless force_schedule_creation ||
                                           transaction.schedule_type_changed? ||
                                           transaction.repeat_interval_changed? ||
                                           transaction.installment_period_changed? ||
                                           transaction.date_changed?

        if transaction.schedule_type == "one_time"
          schedule = {}
        else
          schedule = step Transactions::Operations::Schedules::CreateSchedule.new.call(params)
        end

        transaction.schedule = schedule
        Success(transaction)
      end


      def update_repeat_transactions(transaction:, params:)
        update_scope = params[:update_scope]

        # If no update_scope is specified or it's "this_only", we're done
        return Success(transaction) if update_scope.blank? || update_scope == "this_only"

        # For other scopes, call the repeat transactions update operation
        # This operation handles balance_state assignment based on transaction dates:
        # - Past and current date transactions: balance_state = "calculated" (already reflected in balances)
        # - Future transactions: balance_state = "pending" (will be calculated by daily job)
        UpdateRepeatTransactions.new.call(
          transaction:,
          update_scope:
        )
      end

      def save_transaction(transaction:)
        transaction.save!
        Success(transaction)
      rescue ActiveRecord::ActiveRecordError => e
        Failure(error: e)
      end

      def attach_file(transaction:, params:)
        return Success(transaction) if params[:file].blank?

        transaction.files.destroy_all

        Utils::ActiveStorage.attach_file(transaction.files, params[:file], params[:space_id])
        Success(transaction)
      end
    end
  end
end
