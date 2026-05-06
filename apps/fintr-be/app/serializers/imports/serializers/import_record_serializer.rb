# frozen_string_literal: true

module Imports
  module Serializers
    class ImportRecordSerializer < Blueprinter::Base
      identifier :id

      fields :row_number,
             :original_data,
             :edited_data,
             :status,
             :record_type,
             :record_id,
             :created_at,
             :updated_at

      # Alias import_errors to errors for API consistency
      field :errors do |record|
        record.import_errors || []
      end

      field :is_editable do |record|
        record.editable?
      end

      field :import_data do |record|
        record.import_data
      end
    end
  end
end
