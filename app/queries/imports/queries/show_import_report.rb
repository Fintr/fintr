# frozen_string_literal: true

module Imports
  module Queries
    class ShowImportReport < BaseQuery
      def initialize(import_id:, **kwargs)
        @import_id = import_id
        super(relation: nil, params: kwargs)
      end

      def call
        import = step find_import
        import_data = step build_report_data(import)

        import_data
      end

      private

      def find_import
        import = Imports::Import.find_by(id: @import_id)
        return Failure(error: "Import not found") if import.nil?

        Success(import)
      end

      def build_report_data(import)
        Success(
          {
            import: import,
            statistics: {
              total_rows_read: import.total_rows_read,
              total_rows_inserted: import.total_rows_inserted,
              total_rows_failed: import.total_rows_failed
            },
            errors: import.import_errors,
            successful_records: import.successful_records.count,
            failed_records: import.failed_records.count
          }
        )
      end
    end
  end
end
