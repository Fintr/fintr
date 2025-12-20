# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Imports
  module Operations
    class UpdateImportRecord < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:import_record_id).value(:string)
          optional(:date).value(:string)
          optional(:description).value(:string)
          optional(:amount).value(:decimal)
          optional(:type).value(:string, included_in?: %w[income expense])
          optional(:category).value(:string)
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
        transaction do
          params = step validate(params:)
          import_record = step find_import_record(params[:import_record_id])
          _ = step validate_editable(import_record:)
          edited_data = step build_edited_data(import_record:, params:)
          _ = step update_record(import_record:, edited_data:)

          import_record
        end
      end

      private

      def find_import_record(import_record_id)
        import_record = Imports::ImportRecord.find_by(id: import_record_id)
        return Failure(error: "Import record not found") if import_record.nil?

        Success(import_record)
      end

      def validate_editable(import_record:)
        return Failure(error: "Import record is not editable") unless import_record.editable?

        Success(true)
      end

      def build_edited_data(import_record:, params:)
        # Start with original data and merge edited fields
        edited_data = import_record.original_data.dup

        edited_data[:date] = params[:date] if params[:date].present?
        edited_data[:description] = params[:description] if params[:description].present?
        edited_data[:amount] = params[:amount] if params[:amount].present?
        edited_data[:type] = params[:type]&.downcase if params[:type].present?
        edited_data[:category] = params[:category] if params[:category].present?

        Success(edited_data)
      end

      def update_record(import_record:, edited_data:)
        import_record.mark_as_edited(edited_data)
        Success(true)
      end
    end
  end
end
