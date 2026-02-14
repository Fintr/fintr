# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Transactions
  module Operations
    # NOTE: Create a transaction only at the start. This is the parent transaction.
    class CreateTransaction < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          # Current user and space
          required(:user_id).value(:string)
          required(:space_id).value(:string)
          optional(:transfer_id).value(:string)
          optional(:skip_calculation).maybe(:bool)
          optional(:skip_embedding).value(:bool)

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
          optional(:file_id).maybe(:string)

          optional(:draft).value(:bool)
          optional(:draft_id).maybe(:string)

          # Exchange rate / conversion (optional)
          optional(:original_currency).value(:string)
          optional(:exchange_rate).value(:decimal, gt?: 0)
          optional(:exchange_rate_source).value(:string, included_in?: %w[auto manual recent])
        end

        rule(:original_currency, :exchange_rate) do
          if values[:exchange_rate].present? && values[:original_currency].blank?
            key(:original_currency).failure("must be provided when exchange rate is specified")
          end
        end

        # Validate that schedule_type is valid
        rule(:schedule_type) do
          valid_types = ["one_time", "repeat", "installment"] # Explicitly include all types
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

        Success(contract.to_h)
      end

      include FailureHandler
      include Dry::Operation::Extensions::ActiveRecord

      def call(params)
        params             = step validate(params:)

        skip_embedding     = params[:skip_embedding]
        transaction = transaction do
          category           = step find_category(params:)
          account            = step find_account(params:)
          conversion_data    = step prepare_conversion(params:, account:)
          skip_calculation   = step find_skip_calculation(params:)
          params             = step transform_params(params:, category:, account:, conversion_data:)
          params             = step adjust_amount(params:)
          tx                 = step create_transaction(params:, category:)
          _                  = step create_conversion_record(transaction: tx, conversion_data:)
          _                  = step calculate_balance(transaction: tx, skip_calculation:, params:)
          tx                 = step create_schedule(transaction: tx, params:) if params[:schedule_type] != "one_time"
          _                  = step create_past_transactions(transaction: tx) if params[:schedule_type] != "one_time"
          _                  = step create_future_transactions(transaction: tx) if params[:schedule_type] != "one_time"
          tx
        end

        transaction          = step attach_file(transaction:, params:) # NOTE: ActiveStorage doesn't save the file if inside a transaction block.
        _                    = step remove_draft(params:)
        _                    = step update_monthly_summary(transaction:)
        _                    = step generate_embedding_async(transaction:, skip_embedding:)
        transaction.reload
      end

      private

      def find_category(params:)
        category = Transactions::Category.find_by(name: params[:category_name], space_id: params[:space_id])
        return Failure(category_name: "not found") unless category

        Success(category)
      end

      def find_account(params:)
        account = Transactions::Account.kept.find_by(name: params[:account_name], space_id: params[:space_id])
        return Failure(account_name: "not found") unless account

        Success(account)
      end

      def find_skip_calculation(params:)
        Success(params[:skip_calculation] ? true : false)
      end

      def prepare_conversion(params:, account:)
        original_currency = params[:original_currency] || account.balance_currency
        target_currency = account.balance_currency
        original_amount = params[:amount]

        if original_currency == target_currency
          return Success(
            needs_conversion: false,
            amount: original_amount,
            amount_currency: target_currency
          )
        end

        rate = params[:exchange_rate]
        source = params[:exchange_rate_source]
        unless rate
          rate_result = step ::ExchangeRates::Operations::FetchRate.new.call(
            from_currency: original_currency,
            to_currency: target_currency,
            space_id: params[:space_id],
            date: params[:date]
          )
          rate = rate_result[:rate]
          source = rate_result[:source]
        end

        converted_amount = (BigDecimal(original_amount.to_s) * rate).round(2)
        Success(
          needs_conversion: true,
          original_amount:,
          original_currency:,
          converted_amount:,
          converted_currency: target_currency,
          exchange_rate: rate,
          source: source || "manual",
          rate_timestamp: Time.current
        )
      end

      # Note: Add default values for currencies and repeat_count; use conversion_data when conversion happened
      def transform_params(params:, category:, account:, conversion_data:)
        params = params.dup
        params[:category_id] = category.id
        params[:account_id] = account.id
        params[:repeat_count] = 1 if params[:schedule_type] == "repeat"
        params[:installment_count] = 1 if params[:schedule_type] == "installment"
        params[:balance_state] = "pending"
        params[:amount_currency] = conversion_data[:amount_currency] || conversion_data[:converted_currency] || account.balance_currency
        params[:balance_currency] = params[:amount_currency]
        params[:amount] = conversion_data[:converted_amount] if conversion_data[:needs_conversion]
        params[:balance_cents] = 0 # NOTE: Balance is calculated in the adjust_balance method
        params.delete(:category_name)
        params.delete(:account_name)
        params.delete(:skip_calculation)
        params.delete(:skip_embedding)
        params.delete(:original_currency)
        params.delete(:exchange_rate)
        params.delete(:exchange_rate_source)

        Success(params)
      end

      def create_conversion_record(transaction:, conversion_data:)
        step ::Transactions::Operations::PersistCurrencyConversion.new.call(
          transaction:,
          conversion_data:
        )
        Success(nil)
      end

      def adjust_amount(params:)
        return Success(params) unless params[:schedule_type] == "installment"

        params[:amount] = (BigDecimal(params[:amount].to_s) / params[:installment_period])
                          .round(2, BigDecimal::ROUND_HALF_UP)
        Success(params)
      end

      def create_transaction(params:, category:)
        transaction_type = category.income? ? Transactions::Income : Transactions::Expense
        transaction_type = Transactions::Draft if params[:draft]

        transaction_params = params.except(:file, :draft, :draft_id, :file_id)
        transaction = transaction_type.new(**transaction_params)

        transaction.save!

        Success(transaction)
      rescue ActiveRecord::RecordInvalid => e
        Failure(**transaction.errors.to_hash, error: e, expected: true)
      end

      def calculate_balance(transaction:, skip_calculation:, params:)
        return Success(transaction) if params[:draft]

        Accounts::CalculateBalance.new.call(transaction_id: transaction.id, skip_calculation:)
      end

      def create_schedule(transaction:, params:)
        schedule = step Transactions::Operations::Schedules::CreateSchedule.new.call(params)
        transaction.update!(schedule:)
        Success(transaction)
      rescue ActiveRecord::RecordInvalid => e
        Failure(error: e, schedule: "Failed to update schedule", expected: true)
      end

      # Note: Creates repeat transactions until today
      def create_past_transactions(transaction:)
        return Success() if transaction.schedule_type == "one_time"
        return Success() if transaction.date >= Time.zone.today

        CreateRepeatTransactions.new.call(
          transaction_id: transaction.id,
          balance_state: "calculated",
          date_start: (transaction.date + 1.day).to_datetime, # NOTE: somehow need .to_datetime to avoid errors
          date_end: Time.zone.today
        )
      end

      # Note: Creates repeat transactions until + 1.month
      def create_future_transactions(transaction:)
        return Success() if transaction.schedule_type == "one_time"

        CreateRepeatTransactions.new.call(
          transaction_id: transaction.id,
          balance_state: "pending",
          date_start: Time.zone.tomorrow,
          date_end: Time.zone.today + 1.month
        )
      end

      def attach_file(transaction:, params:)
        return Success(transaction) if params[:file].blank? && params[:file_id].blank?

        Utils::ActiveStorage.attach_file(transaction.files, params[:file], params[:space_id], file_id: params[:file_id])
        Success(transaction)
      end

      def remove_draft(params:)
        return Success() unless params[:draft_id]

        draft = Transactions::Draft.find_by(id: params[:draft_id])
        draft&.destroy!
        Success()
      end

      def update_monthly_summary(transaction:)
        MonthlyFinancialSummaries::Operations::UpdateSummary.new.call(
          space_id: transaction.space_id,
          transaction_date: transaction.date.to_date
        )

        Success()
      end

      def generate_embedding_async(transaction:, skip_embedding:)
        return Success(transaction) if skip_embedding

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
