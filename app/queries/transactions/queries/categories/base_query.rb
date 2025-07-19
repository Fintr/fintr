# frozen_string_literal: true

module Transactions
  module Queries
    module Categories
      class BaseQuery < Transactions::Queries::BaseQuery
        def initialize(relation: Transactions::Category.all, params: {})
          super(relation:, params:)
        end

        attr_reader :for_union, :space

        private

        def by_space(relation, params)
          Success(relation.where(space_id: params[:space_id]))
        end
      end
    end
  end
end
