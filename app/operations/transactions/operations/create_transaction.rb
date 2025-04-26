# frozen_string_literal: true

module Transactions
  module Operations
    # NOTE: Create a transaction only at the start. This is the parent transaction.
    class CreateTransaction < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          # Current user and space
          required(:user_id).value(:string)
          required(:space_id).value(:string)

          required(:amount).value(:decimal)
          required(:date).value(:date)
          required(:category_name).value(:string)
          required(:account_name).value(:string)
          optional(:description).value(:string)

          # Schedule type and related fields
          required(:schedule_type).value(:string)
          optional(:repeat_interval).value(:string)
          optional(:repeat_count).value(:integer)
          optional(:installment_period).value(:integer)
          optional(:installment_count).value(:integer)

          optional(:file)
        end

        # Validate that schedule_type is valid
        rule(:schedule_type) do
          valid_types = [ "one_time", "repeat", "installment" ] # Explicitly include all types
          key.failure("must be one of: #{valid_types.join(", ")}") unless valid_types.include?(value)
        end

        # Validate repeat fields are present when schedule_type is 'repeat'
        rule(:repeat_interval, :schedule_type) do
          key(:repeat_interval).failure("must be provided for recurring transactions") if values[:schedule_type] == "repeat" && value.blank?
        end

        rule(:installment_period) do
        end

        rule(:installment_period, :schedule_type) do
          key(:installment_period).failure("must be provided for installment transactions") if values[:schedule_type] == "installment" && value.blank?
          key(:installment_period).failure("must be a positive integer") if values[:schedule_type] == "installment" && value.present? && (!value.is_a?(Integer) || value <= 0)
        end

        rule(:repeat_interval) do
          valid_intervals = Transactions::Transaction.repeat_intervals.values

          key.failure("must be a valid interval") if value && !valid_intervals.include?(value)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success()
      end

      include FailureHandler

      def call(params:)
        ActiveRecord::Base.transaction do
          _               = step validate(params:)
          category        = step find_category(params:)
          account         = step find_account(params:)
          params          = step transform_params(params:, category:, account:)
          params          = step adjust_amount(params:)
          new_balance     = step adjust_balance(params:, account:, category:)
          transaction     = step create_transaction(params:, category:, new_balance:)
          transaction     = step attach_file(transaction:, params:)
          transaction     = step create_schedule(transaction:, params:) if params[:schedule_type] != "one_time"
          _               = step create_repeat_transactions(transaction:) if params[:schedule_type] != "one_time"
          transaction
        end
      end

      private

      def find_category(params:)
        category = Transactions::Category.find_by(name: params[:category_name], space_id: params[:space_id])
        return Failure(category_name: "not found") unless category

        Success(category)
      end

      def find_account(params:)
        account = Transactions::Account.find_by(name: params[:account_name], space_id: params[:space_id])
        return Failure(account_name: "not found") unless account

        Success(account)
      end

      # Note: Add default values for currencies and repeat_count
      def transform_params(params:, category:, account:)
        params = params.dup
        params[:category_id] = category.id
        params[:account_id] = account.id
        params[:repeat_count] = 1 if params[:schedule_type] == "repeat"
        params[:installment_count] = 1 if params[:schedule_type] == "installment"
        params[:balance_state] = "calculated"
        params[:amount_currency] = "PHP"
        params[:balance_currency] = "PHP"
        params.delete(:category_name)
        params.delete(:account_name)

        Success(params)
      end

      def adjust_amount(params:)
        return Success(params) unless params[:schedule_type] == "installment"

        params[:amount] = (BigDecimal(params[:amount].to_s) / params[:installment_period])
                          .round(2, BigDecimal::ROUND_HALF_UP)
        Success(params)
      end

      def adjust_balance(params:, account:, category:)
        add_amount = category.income? ? params[:amount].to_d : (params[:amount].to_d) * -1
        original_balance = account.balance.amount.to_d
        new_balance = account.balance.amount.to_d + add_amount

        account.update!(balance: new_balance)
        Success(new_balance)
      rescue ActiveRecord::RecordInvalid
        error = "Balance cannot be negative. " \
                "Original balance: #{Utils::Number.format_money(original_balance)}. " \
                "New balance: #{Utils::Number.format_money(new_balance)}"
        Failure(account_name: error)
      end

      def create_transaction(params:, category:, new_balance:)
        transaction_type = category.income? ? Transactions::Income : Transactions::Expense

        transaction_params = params.except(:file)
        transaction = transaction_type.new(**transaction_params)
        transaction.balance = new_balance

        transaction.save!

        Success(transaction)
      rescue StandardError => e
        Failure(**transaction.errors.to_hash, error: e)
      end

      def attach_file(transaction:, params:)
        return Success(transaction) if params[:file].blank?

        transaction.files.attach(params[:file])
        Success(transaction)
      end

      def create_schedule(transaction:, params:)
        schedule_type = params[:schedule_type]
        return Success(transaction) if schedule_type == "one_time"

        repeat_interval = schedule_type == "repeat" ? params[:repeat_interval] : :installment
        schedule = Utils::Recurrence.schedule(
          repeat_interval:,
          date: params[:date],
          installment_period: params[:installment_period]
        )

        transaction.update!(schedule: schedule.to_hash)
        Success(transaction)
      rescue StandardError => e
        Failure(error: e)
      end

      # Note: Creates repeat transactions until + 1.month
      def create_repeat_transactions(transaction:)
        CreateRepeatTransactions.new.call(transaction_id: transaction.id)
      end
    end
  end
end
