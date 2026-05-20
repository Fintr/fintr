# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Transactions
  module Operations
    module Categories
      class ConvertCategoryHierarchy < Dry::Operation
        include Dry::Operation::Extensions::ActiveRecord

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

        def self.validate!(category:, conversion_type:, new_parent_id: nil)
          case conversion_type.to_s
          when "to_subcategory"
            validate_to_subcategory(category:, new_parent_id:)
          when "to_parent"
            validate_to_parent(category:)
          else
            { error: { conversion_type: "is invalid" } }
          end
        end

        def self.validate_to_subcategory(category:, new_parent_id:)
          return { error: { category: "must be a parent category" } } unless category.root?
          return { error: { category: "has subcategories; remove or move them first" } } if category.children.exists?

          if new_parent_id.blank?
            return { error: { new_parent_id: "is required" } }
          end

          new_parent = Transactions::Category.find_by(
            id: new_parent_id,
            space_id: category.space_id
          )
          return { error: { new_parent_id: "not found" } } if new_parent.blank?
          return { error: { new_parent_id: "must be a parent category" } } unless new_parent.root?
          return { error: { new_parent_id: "must match category type" } } if new_parent.category_type != category.category_type
          return { error: { new_parent_id: "cannot be the same category" } } if new_parent.id == category.id

          {
            conversion_type: "to_subcategory",
            new_parent_id: new_parent.id,
            new_parent: new_parent
          }
        end

        def self.validate_to_parent(category:)
          return { error: { category: "is already a parent category" } } if category.root?
          return { error: { category: "has subcategories" } } if category.children.exists?

          {
            conversion_type: "to_parent",
            new_parent_id: nil,
            new_parent: nil
          }
        end

        def self.summarize_transactions(relation)
          income_total = 0.to_d
          expense_total = 0.to_d
          income_count = 0
          expense_count = 0

          relation.find_each do |transaction|
            amount = transaction.amount_numeric_for_space_total.to_d

            case transaction.type
            when "Transactions::Income"
              income_total += amount
              income_count += 1
            when "Transactions::Expense"
              expense_total += amount
              expense_count += 1
            end
          end

          {
            income_total: income_total,
            expense_total: expense_total,
            income_count: income_count,
            expense_count: expense_count,
            transaction_count: income_count + expense_count
          }
        end

        def call(params)
          transaction do
            params   = step validate(params:)
            category = step find_category(params:)
            context  = step validate_conversion(params:, category:)
            step apply_conversion(category:, context:)
          end
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
          result = self.class.validate!(
            category:,
            conversion_type: params[:conversion_type],
            new_parent_id: params[:new_parent_id]
          )
          return Failure(result[:error]) if result[:error]

          Success(result)
        end

        def apply_conversion(category:, context:)
          case context[:conversion_type]
          when "to_subcategory"
            apply_to_subcategory(category:, new_parent: context[:new_parent])
          when "to_parent"
            apply_to_parent(category:)
          else
            Failure(conversion_type: "is invalid")
          end
        end

        def apply_to_subcategory(category:, new_parent:)
          new_parent_id = new_parent.id

          Transactions::Queries::Categories::AffectedByConversion
            .transactions(category:, conversion_type: "to_subcategory")
            .update_all(category_id: new_parent_id, subcategory_id: category.id)

          Transactions::Queries::Categories::AffectedByConversion
            .budgets(category:, conversion_type: "to_subcategory")
            .update_all(category_id: new_parent_id, subcategory_id: category.id)

          category.update!(parent_id: new_parent_id)

          Success(
            {
              category: category.reload,
              redirect_parent_id: new_parent_id
            }
          )
        end

        def apply_to_parent(category:)
          old_parent_id = category.parent_id

          Transactions::Queries::Categories::AffectedByConversion
            .transactions(category:, conversion_type: "to_parent")
            .update_all(category_id: category.id, subcategory_id: nil)

          Transactions::Queries::Categories::AffectedByConversion
            .budgets(category:, conversion_type: "to_parent")
            .update_all(category_id: category.id, subcategory_id: nil)

          category.update!(parent_id: nil)

          Success(
            {
              category: category.reload,
              redirect_parent_id: category.id
            }
          )
        end
      end
    end
  end
end
