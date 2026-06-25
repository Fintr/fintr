# frozen_string_literal: true

module Transactions
  module Queries
    module CategoryFilterValidation
      private

      def validate_category_filter_tokens(params:, space:)
        CategoryFilterTokens.normalize(params).each do |token|
          next if CategoryFilterTokens.kind_token?(token)

          category_id, subcategory_id = token.split(":", 2)
          assignment = Transactions::Operations::ResolveCategoryAssignment.new.call(
            space_id: space.id,
            category_id: category_id,
            subcategory_id: subcategory_id
          )
          return assignment.failure if assignment.failure?
        end

        nil
      end
    end
  end
end
