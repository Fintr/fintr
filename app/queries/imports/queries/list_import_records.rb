# frozen_string_literal: true

module Imports
  module Queries
    class ListImportRecords < BaseQuery
      def initialize(relation: Imports::ImportRecord.all, **kwargs)
        super(relation: relation, params: kwargs)
      end

      def call
        relation = step filter_by_import(@relation, params)
        relation = step filter_by_status(relation, params)
        relation = step order_by_row_number(relation)
        step paginate(relation, params)
      end

      private

      def filter_by_import(relation, params)
        return Failure(error: "import_id is required") unless params[:import_id]

        import = Imports::Import.find_by(id: params[:import_id])
        return Success(relation.none) if import.nil?

        Success(relation.where(import: import))
      end

      def filter_by_status(relation, params)
        return Success(relation) unless params[:status]

        # When filtering by 'failed', include both 'failed' and 'edited' statuses
        # to match the model's failed scope behavior
        if params[:status] == "failed"
          Success(relation.where(status: [:failed, :edited]))
        else
          Success(relation.where(status: params[:status]))
        end
      end

      def order_by_row_number(relation)
        Success(relation.order(row_number: :asc))
      end
    end
  end
end
