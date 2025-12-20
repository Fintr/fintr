# frozen_string_literal: true

module Imports
  module Serializers
    class ImportSerializer < Blueprinter::Base
      identifier :id

      fields :status,
             :import_location,
             :total_rows_read,
             :total_rows_inserted,
             :total_rows_failed,
             :metadata,
             :processed_at,
             :created_at,
             :updated_at

      # Alias import_errors to errors for API consistency (avoiding ActiveRecord conflicts)
      field :errors do |import|
        import.import_errors
      end

      field :successful_records_count do |import|
        import.successful_records.count
      end

      field :failed_records_count do |import|
        import.failed_records.count
      end

      field :can_revert do |import|
        import.can_revert?
      end
    end
  end
end
