# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Imports
  module Operations
    class ImportSingleRecord < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:import_record).value(type?: Imports::ImportRecord)
        end

        rule(:import_record) do
          key.failure("Import record must be persisted") unless value.persisted?
          key.failure("Import record must be editable") unless value.editable?
          key.failure("Import record must be associated with an import") unless value.import.present?
          key.failure("Import record must be associated with a space") unless value.import.space.present?
        end
      end

      class RowDataContract < Dry::Validation::Contract
        params do
          required(:date).filled(:string)
          required(:amount).filled(:decimal, gt?: 0)
          required(:type).filled(:string, included_in?: %w[income expense])
          required(:category).filled(:string)
          optional(:description).value(:string)
        end


        rule(:date) do
          if value.present?
            begin
              Date.parse(value.to_s)
            rescue ArgumentError
              key.failure("Invalid date format: expected YYYY-MM-DD")
            end
          end
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
        import_record      = params[:import_record]

        transaction do
          row_data         = step extract_row_data(import_record:)
          _                = step validate_row_data(row_data:)
          import_account   = step get_or_create_import_account(space_id: import_record.import.space_id)
          category_data    = step find_or_create_category_operation(
                                  space_id: import_record.import.space_id,
                                  import: import_record.import,
                                  import_record: import_record,
                                  row_data: {
                                    category_name: row_data[:category],
                                    category_type: row_data[:type]
                                  }
                                )
          category         = category_data[:category]

          transaction      = step create_transaction(
                                user_id: import_record.import.user_id,
                                space_id: import_record.import.space_id,
                                row_data: row_data,
                                category: category,
                                account: import_account
                              )
          _                = step update_import_record(import_record:, transaction:)
          _                = step update_import_statistics(import: import_record.import)

          transaction
        end
      end

      private

      def extract_row_data(import_record:)
        row_data = import_record.import_data
        # Convert string keys to symbol keys for consistent access
        # JSONB stores keys as strings, but we need symbol keys for hash access
        normalized_data = if row_data.is_a?(Hash)
          row_data.transform_keys(&:to_sym)
        else
          {}
        end
        Success(normalized_data)
      end

      def validate_row_data(row_data:)
        # Data should already have symbol keys from extract_row_data
        # Return early failure if row_data is empty (import_data was not a hash)
        return Failure(error: "Validation failed", errors: { base: ["Import data must be a hash"] }) if row_data.empty?

        contract = RowDataContract.new.call(**row_data)
        return Failure(error: "Validation failed", errors: contract.errors.to_h) unless contract.success?

        # Return normalized data with symbol keys
        validated_data = contract.to_h
        Success({
          date: validated_data[:date].to_s,
          amount: validated_data[:amount],
          type: validated_data[:type].to_s.downcase,
          category: validated_data[:category].to_s,
          description: validated_data[:description].to_s
        })
      end

      def get_or_create_import_account(space_id:)
        Imports::Operations::Accounts::FindOrCreateImportAccount.new.call(space_id:)
      end

      def find_or_create_category_operation(space_id:, import:, row_data:, import_record:)
        # Use the existing FindOrCreateCategory operation
        # row_number is set to 0 since this is a single record import (not from bulk file)
        Categories::FindOrCreateCategory.new.call(
          space_id: space_id,
          row_number: import_record.row_number,
          import: import,
          row_data: row_data
        )
      end

      def create_transaction(user_id:, space_id:, row_data:, category:, account:)
        date = Date.parse(row_data[:date])
        transaction_params = {
          user_id: user_id,
          space_id: space_id,
          amount: row_data[:amount].to_d,
          date:,
          transaction_type: category.category_type,
          category_name: category.name,
          account_name: account.name,
          description: row_data[:description],
          schedule_type: "one_time",
          skip_calculation: true
        }

        result = Transactions::Operations::CreateTransaction.new.call(transaction_params)
        return result unless result.success?

        transaction = result.value!
        transaction.update!(balance_state: "pending") if date > Time.zone.today

        Success(transaction)
      end

      def update_import_record(import_record:, transaction:)
        import_record.update!(
          record_type: transaction.class.name,
          record_id: transaction.id,
          status: "success"
        )
        Success(true)
      end

      def update_import_statistics(import:)
        import.increment!(:total_rows_inserted)
        import.decrement!(:total_rows_failed) if import.total_rows_failed > 0
        Success(true)
      end
    end
  end
end
