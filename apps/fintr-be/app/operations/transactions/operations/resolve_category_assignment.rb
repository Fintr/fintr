# frozen_string_literal: true

module Transactions
  module Operations
    class ResolveCategoryAssignment < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          required(:category_id).value(:string)
          optional(:subcategory_id).maybe(:string)
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
        parent = Transactions::Category.find_by(
          id: params[:category_id],
          space_id: params[:space_id]
        )
        return Failure(category_id: "not found") if parent.blank?
        return Failure(category_id: "must be a parent category") unless parent.root?

        subcategory_id = params[:subcategory_id].presence
        if subcategory_id.blank?
          return Success(
            {
              category_id: parent.id,
              subcategory_id: nil
            }
          )
        end

        sub = Transactions::Category.find_by(
          id: subcategory_id,
          space_id: params[:space_id]
        )
        return Failure(subcategory_id: "not found") if sub.blank?
        return Failure(subcategory_id: "must be a subcategory") unless sub.subcategory?

        if sub.parent_id != parent.id
          return Failure(subcategory_id: "must belong to the selected parent category")
        end

        Success(
          {
            category_id: parent.id,
            subcategory_id: sub.id
          }
        )
      end
    end
  end
end
