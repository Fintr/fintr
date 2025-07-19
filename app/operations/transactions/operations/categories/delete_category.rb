# frozen_string_literal: true

module Transactions
  module Operations
    module Categories
      class DeleteCategory < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:id).value(:string)
            required(:space_id).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)

          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params    = step validate(params:)
          category  = step find_category(params:)
          _         = step validate_can_delete_category(category:)
          category  = step delete_category(category:)

          category
        end

        private

        def find_category(params:)
          category = Transactions::Category.find_by(id: params[:id], space_id: params[:space_id])

          return Failure(category: "Not found") unless category

          Success(category)
        end

        def validate_can_delete_category(category:)
          return Success(category) if category.transactions.empty?

          Failure(category: "Cannot delete category. There are transactions associated with the category.")
        end

        def delete_category(category:)
          category.destroy

          Success(category)
        end
      end
    end
  end
end
