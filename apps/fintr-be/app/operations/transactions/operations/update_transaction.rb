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

      CONVERSION_PARAMS = %i[original_currency exchange_rate exchange_rate_source].freeze

      def call(params)
        transaction = transaction do
          params              = step validate(params:)
          transaction         = step find_transaction(params:)
          space               = step find_space(params:)
          assignment          = step resolve_category_assignment(params:)
          account             = step find_account(params:)
          _                   = step ensure_account_currency_matches_original(transaction:, account:)
          params              = step transform_params(params:, transaction:, assignment:, account:, space:)
          changed_transaction = step initialize_update_transaction(transaction:, params:)
          _                   = step validate_installment_not_changed(transaction: changed_transaction)
          changed_transaction = step update_schedule(transaction: changed_transaction, params:)
          changed_transaction = step update_balance_state(transaction: changed_transaction)
          _                   = step adjust_balance(transaction: changed_transaction)
          new_transaction     = step update_repeat_transactions(transaction: changed_transaction, params:)
          saved_transaction   = step save_transaction(transaction: new_transaction)
          _                   = step persist_currency_conversion(transaction: saved_transaction, params:, account:)
          _                   = step update_transfer_transaction_cost(transaction: saved_transaction) if saved_transaction.transfer
          saved_transaction
        end
        _ = step attach_file(transaction:, params:) # NOTE: ActiveStorage doesn't save the file if inside a transaction block.
        _ = step update_monthly_summary(transaction:)

        # Regenerate embedding if relevant fields changed
        if should_regenerate_embedding?(transaction:, params:)
          step regenerate_embedding_async(transaction:)
        end

        transaction.reload
      end

      private

      def find_transaction(params:)
        transaction = Transaction.find(params[:id])
        Success(transaction)
      rescue ActiveRecord::RecordNotFound
        Failure(id: "transaction not found")
      end

      def ensure_account_currency_matches_original(transaction:, account:)
        original = Transactions::Account.find_by(id: transaction.account_id)
        return Success() unless original

        original_currency = original.balance_currency.presence || "PHP"
        new_currency = account.balance_currency.presence || "PHP"
        return Success() if original_currency == new_currency

        Failure(account_name: "currency cannot be changed")
      end

      def find_space(params:)
        space = Spaces::Space.find(params[:space_id])
        Success(space)
      rescue ActiveRecord::RecordNotFound
        Failure(space_id: "not found")
      end

      def resolve_category_assignment(params:)
        if params[:category_id].present?
          return Transactions::Operations::ResolveCategoryAssignment.new.call(
            space_id: params[:space_id],
            category_id: params[:category_id],
            subcategory_id: params[:subcategory_id]
          )
        end

        category = Transactions::Category.find_by!(
          name: params[:category_name],
          space_id: params[:space_id],
          category_type: params[:transaction_type],
          parent_id: nil
        )
        Success(
          category_id: category.id,
          subcategory_id: nil
        )
      rescue ActiveRecord::RecordNotFound
        Failure(category_name: "not found")
      end

      def find_account(params:)
        account = Transactions::Account.kept.find_by!(name: params[:account_name], space_id: params[:space_id])
        Success(account)
      rescue ActiveRecord::RecordNotFound
        Failure(account_name: "not found")
      end

      # Frontend sends either (a) amount in space currency, or (b) amount in original_currency + conversion metadata (edit with currency_conversion).
      def transform_params(params:, transaction:, assignment:, account:, space:)
        params = params.dup
        conversion = step convert_amount_to_account_currency(params:, transaction:, account:, space:)
        params.merge!(conversion) if conversion.present?

        account_currency = account.balance_currency.presence || "PHP"
        params[:category_id] = assignment[:category_id]
        params[:subcategory_id] = assignment[:subcategory_id]
        params[:category_id] = space.categories.transfer_fee.id if transaction.transfer.present?
        params[:subcategory_id] = nil if transaction.transfer.present?
        params[:account_id] = account.id
        params[:amount_currency] = account_currency
        params[:balance_currency] = account_currency
        params[:balance_cents] = 0 # NOTE: Balance is calculated in the adjust_balance method
        params[:repeat_count] ||= 1 if params[:schedule_type] == "repeat"
        params[:installment_count] ||= 1 if params[:schedule_type] == "installment"
        params.delete(:category_name)
        params.delete(:account_name)
        params.delete(:transaction_type)
        params.delete(:subcategory_id) if params[:subcategory_id].blank?
        Success(params)
      end

      # When edit sends original_currency + exchange_rate, amount is in original currency; else amount is in space currency.
      def convert_amount_to_account_currency(params:, transaction:, account:, space:)
        if params[:original_currency].present? && params[:exchange_rate].present? && params[:amount].present?
          account_currency = account.balance_currency.presence || "PHP"
          if params[:original_currency].to_s == account_currency.to_s
            return Success(amount: BigDecimal(params[:amount].to_s).round(2))
          end

          amount_account = (BigDecimal(params[:amount].to_s) * params[:exchange_rate]).round(2)
          return Success(amount: amount_account)
        end

        ::ExchangeRates::Operations::SpaceAmountToAccountCurrency.new.call(
          amount: params[:amount],
          space_currency: space.currency.presence || "PHP",
          account_currency: account.balance_currency.presence || "PHP",
          date: params[:date] || transaction.date,
          space_id: params[:space_id] || transaction.space_id
        )
      end

      # Persist conversion metadata when amount was converted from space to account currency.
      def persist_currency_conversion(transaction:, params:, account:)
        step ::Transactions::Operations::PersistCurrencyConversion.new.call(
          transaction:,
          params:,
          account:
        )
      end

      def initialize_update_transaction(transaction:, params:)
        assignable = params.except(:id, :update_scope, :file, *CONVERSION_PARAMS)
        transaction.assign_attributes(**assignable)
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



      def update_balance_state(transaction:)
        # Update balance state based on transaction date
        # - Past and current date transactions: balance_state = "calculated" (already reflected in balances)
        # - Future transactions: balance_state = "pending" (will be calculated by daily job)
        balance_state = transaction.date <= Time.zone.today ? "calculated" : "pending"

        # Only update if the balance state is actually changing
        if transaction.balance_state != balance_state
          transaction.balance_state = balance_state
        end

        Success(transaction)
      end

      def adjust_balance(transaction:)
        return Success(transaction) unless transaction.changed?

        case
        when transaction.balance_state_was == "pending" && transaction.balance_state == "calculated"
          result = Transactions::Operations::Accounts::CalculateBalance.new.call(transaction_id: transaction.id)
          return result if result.failure?
        when transaction.balance_state_was == "calculated" && transaction.balance_state == "pending"
          result = Transactions::Operations::Accounts::RemoveCalculation.new.call(transaction_id: transaction.id)
          return result if result.failure?
        when transaction.balance_state_was == "calculated" &&
             transaction.balance_state == "calculated" &&
             %w[amount_cents account_id].any? { |key| transaction.changes.key?(key) }
          result = Transactions::Operations::Accounts::UpdateCalculateBalance.new.call(transaction:)
          return result if result.failure?
        end
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

      def update_transfer_transaction_cost(transaction:)
        transfer = transaction.transfer
        return Success(transaction) unless transfer

        transfer.transaction_cost = transaction.amount
        transfer.save!
        Success(transfer)
      end

      def attach_file(transaction:, params:)
        return Success(transaction) if params[:file].blank?

        transaction.files.destroy_all

        Utils::ActiveStorage.attach_file(transaction.files, params[:file], params[:space_id])
        Success(transaction)
      end

      def update_monthly_summary(transaction:)
        dates = [transaction.date.to_date]

        if transaction.saved_change_to_date?
          previous_date = transaction.saved_change_to_date.first
          if previous_date &&
             (previous_date.year != transaction.date.year ||
              previous_date.month != transaction.date.month)
            dates << previous_date.to_date
          end
        end

        dates.uniq.each do |date|
          MonthlyFinancialSummaries::Operations::UpdateSummary.new.call(
            space_id: transaction.space_id,
            transaction_date: date
          )
        end

        Success()
      end

      def should_regenerate_embedding?(transaction:, params:)
        params.key?(:description) ||
        params.key?(:amount) ||
        params.key?(:category_name) ||
        params.key?(:account_name)
      end

      def regenerate_embedding_async(transaction:)
        Ai::Embeddings::GenerateEmbeddingJob.perform_later(
          embeddable_id: transaction.id,
          embeddable_type: transaction.class.name,
          space_id: transaction.space_id
        )
        Success(transaction)
      end
    end
  end
end
