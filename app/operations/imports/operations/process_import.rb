# frozen_string_literal: true

require "xsv"
require "dry/operation/extensions/active_record"
module Imports
  module Operations
    class ProcessImport < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:import).value(type?: Imports::Import)
        end
      end

      include FailureHandler
      include Dry::Operation::Extensions::ActiveRecord

      def validate(params:)
        contract = Contract.new.call(params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params = step validate(params:)
        import = params[:import]

        # Use update_columns to avoid transaction issues
        import.update_columns(status: "processing")

        result = process_import_with_error_handling(import:)
        if result.failure?
          return result
        end

        _ = step add_embeddings(import:)
        import.reload
      rescue StandardError => e
        # Ensure import status is updated to failed even if transaction rolls back
        # Use update_columns to bypass validations and callbacks
        import.reload
        error_message = "Failed to upload the file: #{e.message}"
        import.update_columns(
          status: "failed",
          import_errors: [error_message]
        )
        # Return failure instead of raising - ensure it's the final return value
        Failure(error: error_message)
      end

      private

      def process_import_with_error_handling(import:)
        begin
          import_account = step get_or_create_import_account(space_id: import.space_id)

          # Call read_excel_file using step to properly handle failures
          rows_data_result = step read_excel_file(import:)

          # Defensive validation - ensure rows_data is valid before proceeding
          # These checks should not be needed if read_excel_file works correctly,
          # but we keep them for defensive programming
          _ = step validate_rows_data(import:, rows_data: rows_data_result)

          _ = step process_rows(import:, rows_data: rows_data_result, import_account:)
          Success(true)
        rescue StandardError => e
          # Ensure import status is updated to failed
          import.reload
          error_message = if e.message.include?("undefined method 'each'") || e.message.include?("nil:NilClass")
            "File format error: The file could not be read. Please ensure you're uploading a valid Excel (.xlsx) file with the correct format."
          else
            "Failed to upload the file: #{e.message}"
          end
          import.update_columns(
            status: "failed",
            import_errors: [error_message]
          )
          # Return failure instead of raising
          Failure(error: error_message)
        end
      end

      def get_or_create_import_account(space_id:)
        Imports::Operations::Accounts::FindOrCreateImportAccount.new.call(space_id:)
      end

      def validate_rows_data(import:, rows_data:)
        if rows_data.nil?
          error_message = "File could not be read. Please ensure you're uploading a valid Excel (.xlsx) file."
          import.reload
          import.update_columns(
            status: "failed",
            import_errors: [error_message]
          )
          return Failure(error: error_message)
        end

        unless rows_data.is_a?(Array)
          error_message = "File format error: The file data is invalid. Please ensure you're uploading a valid Excel (.xlsx) file."
          Rails.logger.error("rows_data is not an array. Class: #{rows_data.class}, Value: #{rows_data.inspect}")
          import.reload
          import.update_columns(
            status: "failed",
            import_errors: [error_message]
          )
          return Failure(error: error_message)
        end

        unless rows_data.any?
          error_message = "No data found in file. Please ensure the file contains at least one data row."
          import.reload
          import.update_columns(
            status: "failed",
            import_errors: [error_message]
          )
          return Failure(error: error_message)
        end

        Success(true)
      end

      def read_excel_file(import:)
        unless import.file.attached?
          # Update status immediately for early failure - use update_columns to bypass transaction
          import.update_columns(status: "failed", import_errors: ["No file attached"])
          return Failure(error: "No file attached")
        end

        # Reload to ensure we have the latest attachment state
        import.reload

        # Verify blob exists
        blob = import.file.blob
        unless blob
          # Update status immediately for early failure
          import.update_columns(status: "failed", import_errors: ["File blob not found"])
          return Failure(error: "File blob not found")
        end

        # Retry logic with exponential backoff: 1s, 2s, 4s, 8s (4 attempts total)
        # For S3/remote storage, files may take a moment to be available after attachment
        max_attempts = 4
        wait_times = [1, 2, 4, 8]

        max_attempts.times do |attempt|
          temp_file = nil
          begin
            # Small initial delay for first attempt to give S3 time to upload
            if attempt.zero?
              sleep(0.5)
              import.reload
            end

            temp_file = Tempfile.new(["import", ".xlsx"])
            temp_file.binmode

            # Try to download the file
            temp_file.write(import.file.download)
            temp_file.rewind

            # Check file extension/content type to provide better error messages
            file_extension = import.file.filename.to_s.downcase
            if file_extension.end_with?(".csv")
              error_message = "CSV files are not supported. Please convert your file to Excel (.xlsx) format and try again."
              import.update_columns(status: "failed", import_errors: [error_message])
              return Failure(error: error_message)
            end

            begin
              workbook = Xsv.open(temp_file.path)
            rescue StandardError => xsv_error
              error_message = "File format error: The file could not be opened as an Excel file. Please ensure you're uploading a valid Excel (.xlsx) file. Error: #{xsv_error.message}"
              Rails.logger.error("Xsv.open failed: #{xsv_error.message}\n#{xsv_error.backtrace.join("\n")}")
              import.update_columns(status: "failed", import_errors: [error_message])
              return Failure(error: error_message)
            end

            sheet = workbook.sheets.first
            if sheet.nil?
              error_message = "Excel file is empty or invalid. Please ensure you're uploading a valid Excel (.xlsx) file."
              # Update status immediately - use update_columns to bypass transaction
              import.update_columns(status: "failed", import_errors: [error_message])
              return Failure(error: error_message)
            end

            # Read all rows (first row is header)
            rows = []
            sheet.each_with_index do |row, index|
              next if index.zero? # Skip header row

              rows << {
                row_number: index + 1,
                data: row
              }
            end

            # Check if we have any data rows
            if rows.empty?
              error_message = "No data rows found in file. Please ensure the file contains at least one data row after the header."
              import.update_columns(status: "failed", import_errors: [error_message])
              return Failure(error: error_message)
            end

            # Success - return the rows
            return Success(rows)
          rescue ActiveStorage::FileNotFoundError => e
            # Clean up temp file before retrying
            if temp_file
              temp_file.close
              temp_file.unlink
            end

            # If this is the last attempt, update status and return failure
            if attempt == max_attempts - 1
              Rails.logger.error("Failed to read Excel file after #{max_attempts} attempts: #{e.message}")
              error_message = "File not found in storage after multiple attempts. Please try uploading again."
              # Update status immediately - use update_columns to bypass transaction
              import.update_columns(status: "failed", import_errors: [error_message])
              return Failure(error: error_message)
            end

            # Wait before retrying (exponential backoff: 1s, 2s, 4s, 8s)
            wait_time = wait_times[attempt] || 8
            Rails.logger.warn("File not ready yet, retrying in #{wait_time} seconds (attempt #{attempt + 1}/#{max_attempts})")
            sleep(wait_time)

            # Reload import to get latest attachment state
            import.reload
          rescue StandardError => e
            # Clean up temp file on other errors
            if temp_file
              temp_file.close
              temp_file.unlink
            end

            # Log the full error with backtrace
            Rails.logger.error("Failed to read Excel file: #{e.message}\n#{e.backtrace.join("\n")}")

            # Provide user-friendly error messages
            error_message = if e.message.include?("No such file") || e.message.include?("cannot open")
              "File format error: Please ensure you're uploading a valid Excel (.xlsx) file. CSV files are not supported."
            elsif e.message.include?("invalid") || e.message.include?("parse")
              "File format error: The file could not be parsed. Please ensure you're uploading a valid Excel (.xlsx) file."
            else
              "Failed to read file: #{e.message}. Please ensure you're uploading a valid Excel (.xlsx) file."
            end

            # Update status immediately - use update_columns to bypass transaction
            import.update_columns(status: "failed", import_errors: [error_message])
            return Failure(error: error_message)
          end
        end

        # Should never reach here, but just in case
        error_message = "Failed to read Excel file after #{max_attempts} attempts"
        import.update_columns(status: "failed", import_errors: [error_message])
        Failure(error: error_message)
      end

      def process_rows(import:, rows_data:, import_account:)
        # Defensive check - ensure rows_data is valid
        unless rows_data.is_a?(Array)
          error_message = "Invalid file data: rows_data must be an array"
          Rails.logger.error("#{error_message}. rows_data class: #{rows_data.class}, value: #{rows_data.inspect}")
          import.update_columns(
            status: "failed",
            import_errors: [error_message]
          )
          return Failure(error: error_message)
        end

        total_read = rows_data.length

        # Step 1: Prepare all categories upfront
        categories_result = step prepare_categories(
          space_id: import.space_id,
          rows_data: rows_data,
          import: import
        )
        category_map = categories_result[:category_map]

        # Step 2: Validate all rows and create import records (both successful and failed)
        validation_result = step validate_and_prepare_rows(
          import: import,
          rows_data: rows_data,
          category_map: category_map,
          import_account: import_account
        )
        validated_rows = validation_result[:validated_rows]
        failed_records = validation_result[:failed_records]

        # Step 3: Bulk import successful transactions
        # Use a separate transaction for bulk import to isolate errors
        bulk_import_result = nil
        begin
          bulk_import_result = step bulk_import_transactions(
            import: import,
            validated_rows: validated_rows,
            import_account: import_account
          )
        rescue ActiveRecord::StatementInvalid, PG::Error => e
          Rails.logger.error("Bulk import failed: #{e.message}\n#{e.backtrace.join("\n")}")
          # Mark all validated rows as failed
          bulk_import_result = { import_records: [] }
        end

        import_records = bulk_import_result[:import_records] if bulk_import_result

        # Calculate statistics
        total_inserted = import_records&.length || 0
        total_failed = failed_records.length + (validated_rows.length - (import_records&.length || 0))

        # Collect errors from failed records
        errors = failed_records.map do |failed|
          {
            row_number: failed[:row_number],
            errors: failed[:errors]
          }
        end

        # Update import status - use update_columns to avoid transaction issues
        import_success = total_inserted == total_read && total_failed.zero?
        import.update_columns(
          total_rows_read: total_read,
          total_rows_inserted: total_inserted,
          total_rows_failed: total_failed,
          import_errors: errors,
          status: import_success ? "completed" : "failed",
          processed_at: Time.current
        )

        Success(true)
      end

      def prepare_categories(space_id:, rows_data:, import:)
        PrepareCategories.new.call(
          space_id: space_id,
          rows_data: rows_data,
          import: import
        )
      end

      def validate_and_prepare_rows(import:, rows_data:, category_map:, import_account:)
        ValidateAndPrepareRows.new.call(
          import: import,
          rows_data: rows_data,
          category_map: category_map,
          import_account: import_account
        )
      end

      def bulk_import_transactions(import:, validated_rows:, import_account:)
        BulkImportTransactions.new.call(
          import: import,
          validated_rows: validated_rows,
          import_account: import_account
        )
      end

      def add_embeddings(import:)
        transactions = %w[Transactions::Transaction Transactions::Expense Transactions::Income]
        import.import_records.successful.where(record_type: transactions).find_each do |import_record|
          transaction = import_record.record
          next unless transaction # Skip if record was deleted

          Ai::Embeddings::GenerateEmbeddingJob.perform_later(
            embeddable_id: transaction.id,
            embeddable_type: transaction.class.name,
            space_id: transaction.space_id
          )
        end
        Success(true)
      rescue StandardError => e
        # Log error but don't fail the import - embeddings are not critical
        Rails.logger.error("Failed to enqueue embedding jobs: #{e.message}\n#{e.backtrace.join("\n")}")
        Success(true) # Return success anyway since embeddings are optional
      end
    end
  end
end
