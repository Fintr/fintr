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
          required(:transaction_type).value(:string, included_in?: %w[income expense])
          optional(:category_name).maybe(:string)
          optional(:category_id).maybe(:string)
          optional(:subcategory_id).maybe(:string)
          # When set, has priority over account_id / account_name; rule validates it is kept and matches space_id
          optional(:account).maybe(type?: Transactions::Account)
          optional(:account_id).maybe(:string)
          optional(:account_name).maybe(:string)
          optional(:description).value(:string)
          optional(:entity_name).maybe(:string)
          optional(:receipt_merchant_detected).maybe(:string)

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

          # ISO code for the currency +amount+ is expressed in (account or space). When it matches the account’s
          # +balance_currency+, no FX is applied. When it matches the space currency and the account differs,
          # +amount+ is treated as space currency and converted to the account (same as omitting this field).
          optional(:amount_in_currency).value(:string)

          # When true (e.g. new account opening), marks the initial-balance transaction; amount is in account currency.
          optional(:initial_balance).value(:bool)

          # Client-generated UUID for idempotent offline / retry creates (FIN-195).
          optional(:client_mutation_id).value(:string)
          optional(:tag_ids).array(:string)
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

        # account (record) has priority: when present, account_id / account_name are not required
        rule(:category_name, :category_id) do
          if values[:category_name].blank? && values[:category_id].blank?
            key(:category_id).failure("category_id or category_name is required")
          end
        end

        rule(:category_id, :subcategory_id) do
          if values[:subcategory_id].present? && values[:category_id].blank?
            key(:category_id).failure("is required when subcategory_id is provided")
          end
        end

        rule(:account, :space_id, :account_id, :account_name) do
          a = values[:account]
          if a.present?
            if a.discarded?
              key(:account).failure("must be active")
            end
            if a.space_id.to_s != values[:space_id].to_s
              key(:account).failure("must belong to the current space")
            end
            next
          end

          next if values[:account_id].present?

          key(:account_name).failure("must be filled") unless values[:account_name].to_s.strip.present?
        end
      end

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?


        Success(result.to_h)
      end

      include FailureHandler
      include Concerns::ResolvesTransactionEntity
      include Concerns::SyncsTransactionTags
      include Dry::Operation::Extensions::ActiveRecord

      def call(params)
        params = step validate(params:)
        transaction = step perform_create(params:)
        step broadcast_created(transaction:, params:)
        step try_unlock_achievements(transaction:)
      end

      private

      def try_unlock_achievements(transaction:)
        Achievements::EventHook.evaluate(
          user_id: transaction.user_id,
          space_id: transaction.space_id,
          event: "transaction_created",
        )
        Success(transaction)
      end

      def broadcast_created(transaction:, params:)
        Transactions::Broadcasts::TransactionChange.created(
          transaction:,
          actor: transaction.user,
          origin_client_mutation_id: params[:client_mutation_id].presence,
        )
        Success(transaction)
      end

      def perform_create(params:)
        existing = find_idempotent_transaction(params:)
        return Success(existing) if existing

        skip_embedding = params[:skip_embedding]

        begin
          transaction = transaction do
            params             = step resolve_transaction_entity(params:)
            assignment         = step resolve_category_assignment(params:)
            account            = step find_account(params: params)
            conversion_data    = step prepare_conversion_data(params:, account:)
            skip_calculation   = step find_skip_calculation(params: params)
            params             = step transform_params(
                                      params:,
                                      assignment:,
                                      account:,
                                      conversion_data:,
                                      )
            params             = step adjust_amount(params: params)
            tx                 = step create_transaction_record(params:)
            _                  = step create_conversion_record(
                                      transaction: tx,
                                      conversion_data:,
                                      )
            _                  = step calculate_balance(
                                      transaction: tx,
                                      skip_calculation:,
                                      params:,
                                      )
            tx                 = step create_schedule(
                                      transaction: tx,
                                      params:,
                                      ) if params[:schedule_type] != "one_time"
            _                  = step create_past_transactions(transaction: tx) if params[:schedule_type] != "one_time"
            _                  = step create_future_transactions(transaction: tx) if params[:schedule_type] != "one_time"
            _                  = step persist_client_mutation(params:, transaction: tx)
            _                  = step sync_transaction_tags(transaction: tx, params:, apply_default: true)
            tx
          end
        rescue ActiveRecord::RecordNotUnique
          replayed = find_idempotent_transaction(params:)
          return Success(replayed) if replayed

          raise
        end

        transaction          = step attach_file(
                                    transaction:,
                                    params:,
                                    ) # NOTE: ActiveStorage doesn't save the file if inside a transaction block.
        _                    = step sync_series_children_files(transaction:)
        _                    = step remove_draft(params: params)
        _                    = step update_monthly_summary(transaction:)
        _                    = step generate_embedding_async(
                                    transaction:,
                                    skip_embedding:,
                                    )
        _                    = step remember_merchant_alias(
                                    params:,
                                    transaction:,
                                    )
        Success(transaction.reload)
      end

      def find_idempotent_transaction(params:)
        client_mutation_id = params[:client_mutation_id].to_s
        return nil if client_mutation_id.blank?

        mutation = Sync::ClientMutation.find_by(
          space_id: params[:space_id],
          client_mutation_id:,
        )
        return nil unless mutation

        Transactions::Transaction.find_by(id: mutation.resource_id)
      end

      def persist_client_mutation(params:, transaction:)
        client_mutation_id = params[:client_mutation_id].to_s
        return Success(transaction) if client_mutation_id.blank?

        Sync::ClientMutation.create!(
          space_id: params[:space_id],
          client_mutation_id:,
          resource_type: transaction.class.name,
          resource_id: transaction.id,
          response_snapshot: { "id" => transaction.id },
        )
        Success(transaction)
      end


      def resolve_category_assignment(params:)
        if params[:category_id].present?
          return Transactions::Operations::ResolveCategoryAssignment.new.call(
            space_id: params[:space_id],
            category_id: params[:category_id],
            subcategory_id: params[:subcategory_id]
          )
        end

        Transactions::Operations::ResolveCategoryByName.new.call(
          space_id: params[:space_id],
          category_name: params[:category_name],
          category_type: params[:transaction_type]
        )
      end

      def find_account(params:)
        return Success(params[:account]) if params[:account].present?

        account = find_account_by_id_or_name(params:)

        return Success(account) if account

        Failure(find_account_failure(params))
      end

      def find_account_by_id_or_name(params:)
        if params[:account_id].present?
          found = Transactions::Account.kept.find_by(id: params[:account_id])
          return found if found && found.space_id.to_s == params[:space_id].to_s

          nil
        else
          Transactions::Account.kept.find_by(
            name: params[:account_name],
            space_id: params[:space_id]
          )
        end
      end

      def find_account_failure(params)
        if params[:account_id].present?
          { account_id: "not found" }
        else
          { account_name: "not found" }
        end
      end

      def find_skip_calculation(params:)
        Success(params[:skip_calculation] ? true : false)
      end

      def prepare_conversion_data(params:, account:)
        ::Transactions::Operations::PrepareCurrencyConversion.new.call(
          params:,
          account:
        )
      end

      # Note: Add default values for currencies and repeat_count; use conversion_data when conversion happened
      def transform_params(params:, assignment:, account:, conversion_data:)
        params = params.dup
        params[:category_id] = assignment[:category_id]
        params[:subcategory_id] = assignment[:subcategory_id]
        params[:account_id] = account.id
        params[:repeat_count] = 1 if params[:schedule_type] == "repeat"
        params[:installment_count] = 1 if params[:schedule_type] == "installment"
        params[:balance_state] = "pending"
        params[:amount_currency] = conversion_data[:amount_currency] || conversion_data[:converted_currency] || account.balance_currency
        params[:balance_currency] = params[:amount_currency]
        params[:amount] = conversion_data[:converted_amount] if conversion_data[:needs_conversion]
        params[:balance_cents] = 0 # NOTE: Balance is calculated in the adjust_balance method
        params.delete(:account)
        params.delete(:category_name)
        params.delete(:subcategory_id) if params[:subcategory_id].blank?
        params.delete(:account_name)
        params.delete(:transaction_type)
        params.delete(:skip_calculation)
        params.delete(:skip_embedding)
        params.delete(:original_currency)
        params.delete(:exchange_rate)
        params.delete(:exchange_rate_source)
        params.delete(:initial_balance)
        params.delete(:amount_in_currency)

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

      def create_transaction_record(params:)
        category = Transactions::Category.find(params[:category_id])
        type_klass = category.income? ? Transactions::Income : Transactions::Expense
        type_klass = Transactions::Draft if params[:draft]

        transaction_params = params.except(
          :file,
          :draft,
          :draft_id,
          :file_id,
          :account,
          :client_mutation_id,
          :tag_ids,
        )
        transaction = type_klass.new(**transaction_params)

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
          date_end: Time.zone.today,
          suppress_actor_toast: true,
        )
      end

      # Note: Creates repeat transactions until + 1.month
      def create_future_transactions(transaction:)
        return Success() if transaction.schedule_type == "one_time"

        CreateRepeatTransactions.new.call(
          transaction_id: transaction.id,
          balance_state: "pending",
          date_start: Time.zone.tomorrow,
          date_end: Time.zone.today + 1.month,
          suppress_actor_toast: true,
        )
      end

      def attach_file(transaction:, params:)
        return Success(transaction) if params[:file].blank? && params[:file_id].blank?

        Utils::ActiveStorage.attach_file(transaction.files, params[:file], params[:space_id], file_id: params[:file_id])
        Success(transaction)
      end

      def sync_series_children_files(transaction:)
        Utils::ActiveStorage.sync_template_files_to_children(source_record: transaction)
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

      def remember_merchant_alias(params:, transaction:)
        return Success(transaction) if params[:draft]
        return Success(transaction) if params[:receipt_merchant_detected].blank?
        return Success(transaction) if transaction.entity_id.blank?

        Entities::Operations::UpsertMerchantAlias.new.call(
          space_id: params[:space_id],
          scanned_name: params[:receipt_merchant_detected],
          entity_id: transaction.entity_id,
        )

        Success(transaction)
      end
    end
  end
end
