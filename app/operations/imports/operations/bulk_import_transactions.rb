# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Imports
  module Operations
    class BulkImportTransactions < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:import).value(type?: Imports::Import)
          required(:import_account).value(type?: Transactions::Account)
          required(:validated_rows).array(:hash) do
            required(:row_data).hash do
              required(:amount).value(:decimal, gt?: 0)
              optional(:description).value(:string)
              required(:category).value(:string)
              required(:date).value(:string, format?: /\A\d{4}-\d{2}-\d{2}\z/)
            end
            required(:category).value(type?: Transactions::Category)
            required(:parsed_date).value(:date)
            required(:row_number).value(:integer)
          end
        end
      end

      include FailureHandler
      include Dry::Operation::Extensions::ActiveRecord

      BATCH_SIZE = 1000

      def call(params)
        import = params[:import]
        validated_rows = params[:validated_rows]
        import_account = params[:import_account]

        return { import_records: [] } if validated_rows.empty?

        # Prepare transactions for bulk import
        transactions_to_create = prepare_transactions(
          validated_rows: validated_rows,
          import: import,
          import_account: import_account
        )

        # Bulk import in batches - each batch in its own transaction to isolate errors
        import_records = []
        failed_batches = []

        transactions_to_create.each_slice(BATCH_SIZE) do |batch|
          batch_import_records = []
          batch_transactions_map = nil

          # Each batch runs in its own transaction to prevent one failure from aborting all
          ActiveRecord::Base.transaction(requires_new: true) do
            begin
              batch_result = import_batch(
                batch: batch,
                import: import
              )
              batch_transactions_map = batch_result[:imported_transactions_map]
            rescue ActiveRecord::StatementInvalid, PG::Error => e
              # Rollback this batch's transaction
              Rails.logger.error("Failed to import batch: #{e.message}\n#{e.backtrace.join("\n")}")
              # Mark batch as failed - will create failed records outside this transaction
              failed_batches << batch
              # Rollback this transaction
              raise ActiveRecord::Rollback
            end
          end

          # Prepare import records for batch creation outside the transaction
          if batch_transactions_map
            batch.each do |item|
              transaction = item[:transaction]
              key = build_transaction_key(transaction)
              imported_transaction = batch_transactions_map[key]

              if imported_transaction
                # Prepare import record for batch import
                import_record = Imports::ImportRecord.new(
                  import: import,
                  record_type: imported_transaction.class.name,
                  record_id: imported_transaction.id,
                  row_number: item[:row_number],
                  original_data: item[:row_data],
                  status: "success"
                )
                batch_import_records << import_record
              else
                # Transaction was not imported successfully
                failed_batches << [item]
              end
            end

            # Batch import all successful import records
            if batch_import_records.any?
              ActiveRecord::Base.transaction(requires_new: true) do
                begin
                  Imports::ImportRecord.import(
                    batch_import_records,
                    validate: true
                  )
                  import_records.concat(batch_import_records)
                rescue StandardError => e
                  Rails.logger.error("Failed to batch import records: #{e.message}\n#{e.backtrace.join("\n")}")
                  # If batch import fails, create them individually as fallback
                  batch_import_records.each do |record|
                    begin
                      record.save!
                      import_records << record
                    rescue StandardError => individual_error
                      Rails.logger.error("Failed to create individual import record: #{individual_error.message}")
                      # Add to failed batches if we can't create the record
                      failed_batches << [{
                        row_number: record.row_number,
                        row_data: record.original_data
                      }]
                    end
                  end
                  raise ActiveRecord::Rollback
                end
              end
            end
          end
        end

        # Batch create failed import records for failed batches
        # This ensures we can create them even if previous transactions were aborted
        failed_items = failed_batches.flatten
        if failed_items.any?
          failed_import_records = failed_items.map do |item|
            Imports::ImportRecord.new(
              import: import,
              row_number: item[:row_number],
              original_data: item[:row_data],
              status: "failed",
              import_errors: ["Database error during bulk import"]
            )
          end

          # Batch import failed records in batches of BATCH_SIZE
          failed_import_records.each_slice(BATCH_SIZE) do |failed_batch|
            ActiveRecord::Base.transaction(requires_new: true) do
              begin
                Imports::ImportRecord.import(
                  failed_batch,
                  validate: true
                )
              rescue StandardError => e
                Rails.logger.error("Failed to batch import failed records: #{e.message}\n#{e.backtrace.join("\n")}")
                # If batch import fails, create them individually as fallback
                failed_batch.each do |record|
                  begin
                    record.save!
                  rescue StandardError => individual_error
                    Rails.logger.error("Failed to create individual failed import record: #{individual_error.message}")
                  end
                end
                raise ActiveRecord::Rollback
              end
            end
          end
        end

        { import_records: }
      end

      private

      def prepare_transactions(validated_rows:, import:, import_account:)
        transactions_to_create = []

        validated_rows.each do |row_info|
          row_data = row_info[:row_data]
          category = row_info[:category]
          parsed_date = row_info[:parsed_date]

          # Determine transaction type based on category
          transaction_type = category.income? ? Transactions::Income : Transactions::Expense

          # Convert amount to cents
          amount_cents = (row_data[:amount].to_d * 100).to_i

          transaction = transaction_type.new(
            user_id: import.user_id,
            space_id: import.space_id,
            category_id: category.id,
            account_id: import_account.id,
            date: parsed_date,
            description: row_data[:description],
            amount_cents: amount_cents,
            amount_currency: "PHP",
            balance_cents: 0, # Will be calculated later
            balance_currency: "PHP",
            type: transaction_type.name,
            schedule_type: "one_time",
            balance_state: "calculated"
          )

          transactions_to_create << {
            transaction: transaction,
            row_number: row_info[:row_number],
            row_data: row_data
          }
        end

        transactions_to_create
      end

      def import_batch(batch:, import:)
        transactions = batch.map { |item| item[:transaction] }

        # Bulk import transactions by type
        transaction_types = transactions.map(&:class).uniq
        imported_transactions_map = {}

        transaction_types.each do |transaction_type|
          type_transactions = transactions.select { |t| t.is_a?(transaction_type) }
          next if type_transactions.empty?

          # Use activerecord-import to bulk insert
          transaction_type.import(
            type_transactions,
            validate: true
          )

          # Build a map to match transactions back to their row data
          # We'll use a combination of attributes as the key
          type_transactions.each do |t|
            key = build_transaction_key(t)
            imported = transaction_type.find_by(
              user_id: t.user_id,
              space_id: t.space_id,
              category_id: t.category_id,
              account_id: t.account_id,
              date: t.date,
              description: t.description,
              amount_cents: t.amount_cents
            )
            imported_transactions_map[key] = imported if imported
          end
        end

        # Return the mapping - import records will be created outside this transaction
        {
          imported_transactions_map: imported_transactions_map
        }
      end

      def build_transaction_key(transaction)
        "#{transaction.user_id}:#{transaction.space_id}:#{transaction.category_id}:#{transaction.account_id}:#{transaction.date}:#{transaction.description}:#{transaction.amount_cents}"
      end
    end
  end
end
