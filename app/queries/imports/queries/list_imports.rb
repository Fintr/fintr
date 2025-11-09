# frozen_string_literal: true

module Imports
  module Queries
    class ListImports < BaseQuery
      def initialize(relation: Imports::Import.all, **kwargs)
        super(relation: relation, params: kwargs)
      end

      def call
        relation = step filter_by_status(@relation, params)
        relation = step order_by_recent(relation)
        step paginate(relation, params)
      end

      private

      def filter_by_status(relation, params)
        return Success(relation) unless params[:status]

        Success(relation.where(status: params[:status]))
      end

      def order_by_recent(relation)
        Success(relation.order(created_at: :desc))
      end
    end
  end
end
