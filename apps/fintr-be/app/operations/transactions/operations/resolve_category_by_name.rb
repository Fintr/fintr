# frozen_string_literal: true

module Transactions
  module Operations
    class ResolveCategoryByName < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          required(:category_name).value(:string)
          required(:category_type).value(:string, included_in?: %w[income expense])
        end
      end

      def call(params)
        params = step validate(params:)
        step resolve_assignment(params:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def resolve_assignment(params:)
        scope = Transactions::Category.where(
          space_id: params[:space_id],
          category_type: params[:category_type]
        )

        parent = scope.roots.find_by(name: params[:category_name])

        if parent
          return Success(
            category_id: parent.id,
            subcategory_id: nil
          )
        end

        subcategories = scope.subcategories
                             .where(name: params[:category_name])
                             .includes(:parent)
                             .to_a

        return Failure(category_name: "not found") if subcategories.empty?
        return Failure(category_name: "ambiguous") if subcategories.size > 1

        subcategory = subcategories.first

        Success(
          category_id: subcategory.parent_id,
          subcategory_id: subcategory.id
        )
      end
    end
  end
end
