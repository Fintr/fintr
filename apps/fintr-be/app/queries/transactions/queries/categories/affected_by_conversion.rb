# frozen_string_literal: true

module Transactions
  module Queries
    module Categories
      class AffectedByConversion
        def self.transactions(category:, conversion_type:)
          scope = Transactions::Transaction.where(space_id: category.space_id)

          case conversion_type.to_s
          when "to_subcategory"
            scope.where(category_id: category.id, subcategory_id: nil)
          when "to_parent"
            scope.where(
              category_id: category.parent_id,
              subcategory_id: category.id
            )
          else
            scope.none
          end
        end

        def self.budgets(category:, conversion_type:)
          scope = Budget.where(space_id: category.space_id)

          case conversion_type.to_s
          when "to_subcategory"
            scope.where(category_id: category.id, subcategory_id: nil)
          when "to_parent"
            scope.where(
              category_id: category.parent_id,
              subcategory_id: category.id
            )
          else
            scope.none
          end
        end
      end
    end
  end
end
