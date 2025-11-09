# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Imports
  module Operations
    class RevertImport < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:import).value(type?: Imports::Import)
        end

        rule(:import) do
          key.failure("Import cannot be reverted") unless value.can_revert?
        end
      end

      include FailureHandler
      include Dry::Operation::Extensions::ActiveRecord


      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params            = step validate(params:)
        import            = params[:import]
        transaction do
          result          = step revert_transaction_records(import:)
          category_result = step revert_category_records(import:)
          _               = step update_import_status(import:)

          merge_results(result, category_result)
        end
      end

      private

      def revert_transaction_records(import:)
        # Exclude category records - they're handled separately in revert_category_records
        successful_records = import.import_records.successful
                                    .where.not(record_type: "Transactions::Category")
        reverted_count = 0
        errors = []

        successful_records.find_each do |import_record|
          result = destroy_record(import_record:)
          if result.success?
            reverted_count += 1
          else
            errors << result.failure[:error]
          end
        end

        Success({ reverted_count: reverted_count, errors: errors })
      end

      def destroy_record(import_record:)
        record = import_record.record
        if record
          record.destroy
          import_record.destroy
          Success(true)
        else
          import_record.destroy
          Success(true)
        end
      rescue StandardError => e
        Failure(error: "Failed to revert record #{import_record.id}: #{e.message}")
      end

      def revert_category_records(import:)
        category_records = import.import_records.successful.where(record_type: "Transactions::Category")
        deleted_count = 0
        errors = []

        category_records.find_each do |import_record|
          result = destroy_category_if_safe(import_record:)
          if result.success?
            deleted_count += 1
          else
            errors << result.failure[:error]
          end
        end

        Success({ deleted_count: deleted_count, errors: errors })
      end

      def destroy_category_if_safe(import_record:)
        category = import_record.record
        return Success(true) unless category

        if category.transactions.empty?
          category.destroy
          import_record.destroy
          Success(true)
        else
          Failure(error: "Category '#{category.name}' cannot be deleted: has existing transactions")
        end
      end

      def update_import_status(import:)
        import.update!(status: "reverted")
        Success(true)
      end

      def merge_results(transaction_result, category_result)
        all_errors = transaction_result[:errors] + category_result[:errors]
        reverted_count = transaction_result[:reverted_count]
        deleted_categories_count = category_result[:deleted_count]

        message_parts = []
        message_parts << "#{reverted_count} transaction#{'s' unless reverted_count == 1}" if reverted_count > 0
        message_parts << "#{deleted_categories_count} categor#{deleted_categories_count == 1 ? 'y' : 'ies'}" if deleted_categories_count > 0

        if all_errors.any?
          message = message_parts.any? ? "Import reverted: #{message_parts.join(' and ')} deleted with #{all_errors.length} warning#{'s' unless all_errors.length == 1}" : "Import reverted with #{all_errors.length} warning#{'s' unless all_errors.length == 1}"
          { message: message, warnings: all_errors, reverted_count: reverted_count, deleted_categories_count: deleted_categories_count }
        else
          message = message_parts.any? ? "Import reverted successfully: #{message_parts.join(' and ')} deleted" : "Import reverted successfully"
          { message: message, reverted_count: reverted_count, deleted_categories_count: deleted_categories_count }
        end
      end
    end
  end
end
