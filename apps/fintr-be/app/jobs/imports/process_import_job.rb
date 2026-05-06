# frozen_string_literal: true

module Imports
  class ProcessImportJob < ApplicationJob
    queue_as :default

    def perform(import_id)
      import = Imports::Import.find_by(id: import_id)
      return if import.nil?

      result = Imports::Operations::ProcessImport.new.call(import: import)

      unless result.success?
        # Mark as failed immediately - retry logic is handled in the operation
        error_message = extract_error_message(result.failure)
        import.update!(
          status: "failed",
          import_errors: [error_message]
        )
        Rails.logger.error("Import #{import_id} failed: #{result.failure}")
      end
    rescue StandardError => e
      error_message = "Failed to upload the file: #{e.message}"
      import&.update!(
        status: "failed",
        import_errors: [error_message]
      )
      Rails.logger.error("Import #{import_id} job error: #{e.message}\n#{e.backtrace.join("\n")}")
      Sentry.capture_exception(e)
    end

    private

    def extract_error_message(failure)
      if failure.is_a?(Hash)
        # Try to get a user-friendly error message
        if failure[:error].present?
          error_text = failure[:error].to_s
          # Check if it's a file upload error - use the error as-is if it already mentions upload
          if error_text.include?("No file attached") ||
             error_text.include?("Failed to upload") ||
             error_text.include?("Failed to read Excel file") ||
             error_text.include?("Excel file is empty")
            # Error already contains "Failed to upload the file:" prefix from read_excel_file
            error_text
          else
            # For other errors, provide a generic message
            "Failed to process import: #{error_text}"
          end
        elsif failure[:errors].present?
          # If it's a hash of errors, get the first meaningful error
          errors = failure[:errors]
          if errors.is_a?(Hash)
            first_error = errors.values.flatten.first
            first_error.present? ? first_error.to_s : "Failed to process import"
          elsif errors.is_a?(Array)
            errors.first.present? ? errors.first.to_s : "Failed to process import"
          else
            "Failed to process import"
          end
        else
          "Failed to process import"
        end
      else
        failure.to_s.present? ? failure.to_s : "Failed to process import"
      end
    end
  end
end
