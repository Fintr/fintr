# frozen_string_literal: true

module Budgets
  module Operations
    class ValidateCategoryBudgetAllocation < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          required(:category_id).value(:string)
          optional(:subcategory_id).maybe(:string)
          required(:date).value(:date)
          required(:amount).value(:integer)
          optional(:exclude_budget_id).maybe(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        month_date = params[:date].to_date
        proposed_cents = params[:amount] * 100
        subcategory_id = params[:subcategory_id].presence

        if subcategory_id.blank?
          step validate_parent_budget(params:, month_date:, proposed_cents:)
        else
          step validate_subcategory_budget(params:, month_date:, proposed_cents:, subcategory_id:)
        end
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def validate_parent_budget(params:, month_date:, proposed_cents:)
        allocated_cents = subcategory_budgets_sum(
          space_id: params[:space_id],
          category_id: params[:category_id],
          month_date:,
          exclude_budget_id: params[:exclude_budget_id]
        )

        if proposed_cents < allocated_cents
          return Failure(
            allocation_exceeded: "Parent budget cannot be less than the sum of subcategory budgets",
            parent_budget_cents: proposed_cents,
            allocated_to_subcategories_cents: allocated_cents,
            remaining_cents: proposed_cents - allocated_cents
          )
        end

        Success(
          {
            parent_budget_cents: proposed_cents,
            allocated_to_subcategories_cents: allocated_cents,
            remaining_cents: proposed_cents - allocated_cents
          }
        )
      end

      def validate_subcategory_budget(params:, month_date:, proposed_cents:, subcategory_id:)
        parent_budget = parent_budget_for_month(
          space_id: params[:space_id],
          category_id: params[:category_id],
          month_date:
        )

        if parent_budget.blank?
          return Failure(
            parent_budget_missing: "Create a parent category budget before adding subcategory budgets"
          )
        end

        sibling_allocated_cents = subcategory_budgets_sum(
          space_id: params[:space_id],
          category_id: params[:category_id],
          month_date:,
          exclude_budget_id: params[:exclude_budget_id],
          exclude_subcategory_id: subcategory_id
        )

        total_allocated = sibling_allocated_cents + proposed_cents
        parent_cap = parent_budget.amount_cents

        if total_allocated > parent_cap
          return Failure(
            allocation_exceeded: "Subcategory budgets cannot exceed the parent budget",
            parent_budget_cents: parent_cap,
            allocated_to_subcategories_cents: sibling_allocated_cents,
            remaining_cents: parent_cap - sibling_allocated_cents,
            proposed_cents:
          )
        end

        Success(
          {
            parent_budget_cents: parent_cap,
            allocated_to_subcategories_cents: sibling_allocated_cents,
            remaining_cents: parent_cap - total_allocated
          }
        )
      end

      def parent_budget_for_month(space_id:, category_id:, month_date:)
        Budget.where(space_id:, category_id:, subcategory_id: nil)
              .for_month(month_date)
              .first
      end

      def subcategory_budgets_sum(space_id:, category_id:, month_date:, exclude_budget_id:, exclude_subcategory_id: nil)
        scope = Budget.where(space_id:, category_id:)
                      .where.not(subcategory_id: nil)
                      .for_month(month_date)
        scope = scope.where.not(id: exclude_budget_id) if exclude_budget_id.present?
        scope = scope.where.not(subcategory_id: exclude_subcategory_id) if exclude_subcategory_id.present?

        scope.sum(:amount_cents)
      end
    end
  end
end
