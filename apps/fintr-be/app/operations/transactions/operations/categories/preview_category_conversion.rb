# frozen_string_literal: true

module Transactions
  module Operations
    module Categories
      class PreviewCategoryConversion < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:id).value(:string)
            required(:space_id).value(:string)
            required(:conversion_type).value(:string)
            optional(:new_parent_id).maybe(:string)
          end

          rule(:conversion_type) do
            unless %w[to_subcategory to_parent].include?(value)
              key.failure("must be to_subcategory or to_parent")
            end
          end
        end

        def call(params)
          params   = step validate(params:)
          category = step find_category(params:)
          context  = step validate_conversion(params:, category:)
          step build_preview(category:, context:)
        end

        private

        def validate(params:)
          result = Contract.new.call(**params)
          return Failure(result.errors.to_h) unless result.success?

          Success(result.to_h)
        end

        def find_category(params:)
          category = Transactions::Category.find_by(
            id: params[:id],
            space_id: params[:space_id]
          )
          return Failure(category: "not found") unless category

          Success(category)
        end

        def validate_conversion(params:, category:)
          result = ConvertCategoryHierarchy.validate!(
            category:,
            conversion_type: params[:conversion_type],
            new_parent_id: params[:new_parent_id]
          )
          return Failure(result[:error]) if result[:error]

          Success(result)
        end

        def build_preview(category:, context:)
          transactions = Transactions::Queries::Categories::AffectedByConversion
                           .transactions(
                             category:,
                             conversion_type: context[:conversion_type]
                           )

          totals = ConvertCategoryHierarchy.summarize_transactions(transactions)
          budget_count = Transactions::Queries::Categories::AffectedByConversion
                           .budgets(
                             category:,
                             conversion_type: context[:conversion_type]
                           )
                           .count

          Success(
            {
              conversion_type: context[:conversion_type],
              category_id: category.id,
              category_name: category.name,
              new_parent_id: context[:new_parent_id],
              new_parent_name: context[:new_parent]&.name,
              transaction_count: totals[:transaction_count],
              income_count: totals[:income_count],
              expense_count: totals[:expense_count],
              income_total: totals[:income_total],
              expense_total: totals[:expense_total],
              budget_count: budget_count
            }
          )
        end
      end
    end
  end
end
