# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Imports
  module Operations
    class ValidateAndPrepareRows < Dry::Operation
      include FailureHandler
      include Dry::Operation::Extensions::ActiveRecord

      def call(params)
        import = params[:import]
        rows_data = params[:rows_data]
        category_map = params[:category_map]
        import_account = params[:import_account]

        # Validate rows_data
        unless rows_data.is_a?(Array)
          return Failure(error: "Invalid file data: rows_data must be an array")
        end

        validated_rows = []
        failed_records = []

        rows_data.each do |row_info|
          row_number = row_info[:row_number]
          row = row_info[:data]

          # Parse row data
          row_data = parse_row_data(row)

          # Validate row
          validation_result = validate_row(
            row_data: row_data,
            row_number: row_number,
            category_map: category_map
          )

          if validation_result[:success]
            validated_rows << {
              row_number: row_number,
              row_data: row_data,
              category: validation_result[:category],
              parsed_date: validation_result[:parsed_date]
            }
          else
            # Create failed import record
            create_failed_import_record(
              import: import,
              row_number: row_number,
              row_data: row_data,
              errors: validation_result[:errors]
            )
            failed_records << {
              row_number: row_number,
              errors: validation_result[:errors]
            }
          end
        end

        {
          validated_rows: validated_rows,
          failed_records: failed_records
        }
      end

      private

      def parse_row_data(row)
        {
          date: row[0]&.to_s&.strip,
          description: row[1]&.to_s&.strip,
          amount: row[2]&.to_i,
          type: row[3]&.to_s&.strip&.downcase,
          category: row[4]&.to_s&.strip
        }
      end

      def validate_row(row_data:, row_number:, category_map:)
        errors = []

        # Validate date format
        parsed_date = validate_date_format(row_data[:date], errors)

        # Validate amount
        if row_data[:amount].nil? || row_data[:amount] <= 0
          errors << "Amount must be greater than 0"
        end

        # Validate type
        unless %w[income expense].include?(row_data[:type])
          errors << "Type must be 'income' or 'expense'"
        end

        # Validate category exists
        category_key = "#{row_data[:type]}:#{row_data[:category]}"
        category = category_map[category_key]
        if category.nil?
          errors << "Category '#{row_data[:category]}' not found for type '#{row_data[:type]}'"
        end

        # Description is optional - no validation needed

        if errors.any?
          {
            success: false,
            errors: errors
          }
        else
          {
            success: true,
            category: category,
            parsed_date: parsed_date
          }
        end
      end

      def validate_date_format(date_string, errors)
        return nil if date_string.blank?

        # Check format first
        unless date_string.match?(/\A\d{4}-\d{2}-\d{2}\z/)
          errors << "Date must be in YYYY-MM-DD format"
          return nil
        end

        # Try to parse
        Date.parse(date_string)
      rescue ArgumentError
        errors << "Invalid date format: #{date_string}"
        nil
      end

      def create_failed_import_record(import:, row_number:, row_data:, errors:)
        # Filter out nil/null/empty values
        errors_array = errors.compact.reject { |e| e.nil? || (e.is_a?(String) && e.strip.empty?) }

        # If all errors were filtered out, provide a default message
        errors_array = ["Record validation failed"] if errors_array.empty?

        Imports::ImportRecord.create!(
          import: import,
          row_number: row_number,
          original_data: row_data,
          status: "failed",
          import_errors: errors_array
        )
      rescue StandardError => e
        Rails.logger.error("Failed to create failed import record: #{e.message}\n#{e.backtrace.join("\n")}")
      end
    end
  end
end
