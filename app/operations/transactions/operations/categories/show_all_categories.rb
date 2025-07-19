# frozen_string_literal: true

module Transactions
  module Operations
    module Categories
      class ShowAllCategories < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params              = step validate(params:)
          expense_categories  = step get_expense_categories(params:)
          income_categories   = step get_income_categories(params:)

          { expense_categories:, income_categories: }
        end

        private

        def get_expense_categories(params:)
          query = Transactions::Queries::Categories::AllCategories
                    .call(params: params.merge(category_type: "expense"))

          Success(query.value!)
        end

        def get_income_categories(params:)
          query = Transactions::Queries::Categories::AllCategories
                    .call(params: params.merge(category_type: "income"))

          Success(query.value!)
        end
      end
    end
  end
end
