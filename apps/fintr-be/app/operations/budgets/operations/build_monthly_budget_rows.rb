# frozen_string_literal: true

module Budgets
  module Operations
    class BuildMonthlyBudgetRows < Dry::Operation
      def call(budgets:, space_id:, start_date:, end_date:)
        step build_rows(budgets:, space_id:, start_date:, end_date:)
      end

      private

      def build_rows(budgets:, space_id:, start_date:, end_date:)
        rows_by_parent = {}

        budgets.each do |budget|
          spent = spent_for_budget(
            budget:,
            space_id:,
            start_date:,
            end_date:
          )

          if budget.parent_budget?
            rows_by_parent[budget.category_id] ||= parent_row_skeleton(budget, spent)
            assign_parent_amount(
              row: rows_by_parent[budget.category_id],
              budget:,
            )
          else
            rows_by_parent[budget.category_id] ||= parent_row_skeleton(
              budget,
              parent_spent(
                category_id: budget.category_id,
                space_id:,
                start_date:,
                end_date:
              )
            )
            rows_by_parent[budget.category_id][:subcategories] << subcategory_row(
              budget:,
              spent:,
            )
          end
        end

        finalize_parent_rows(
          rows_by_parent,
          space_id:,
          start_date:,
          end_date:,
        )

        Success(rows_by_parent.values)
      end

      def parent_row_skeleton(budget, spent)
        {
          id: budget.id,
          category_id: budget.category_id,
          subcategory_id: nil,
          category_name: budget.category.name,
          date: budget.date,
          amount_currency: budget.amount_currency,
          amount: 0,
          budget: 0,
          has_explicit_parent_budget: false,
          total_spent: spent,
          subcategories: []
        }
      end

      def assign_parent_amount(row:, budget:)
        amount = budget.amount_cents / 100
        row[:id] = budget.id
        row[:date] = budget.date
        row[:amount_currency] = budget.amount_currency
        row[:amount] = amount
        row[:budget] = amount
        row[:has_explicit_parent_budget] = true
      end

      def subcategory_row(budget:, spent:)
        amount = budget.amount_cents / 100

        {
          id: budget.id,
          category_id: budget.category_id,
          subcategory_id: budget.subcategory_id,
          subcategory_name: budget.subcategory&.name,
          amount: amount,
          budget: amount,
          spent: spent,
          date: budget.date,
          amount_currency: budget.amount_currency
        }
      end

      def finalize_parent_rows(rows_by_parent, space_id:, start_date:, end_date:)
        rows_by_parent.each_value do |row|
          next if row[:subcategories].blank?

          row[:parent_only_spent] = parent_only_spent(
            category_id: row[:category_id],
            space_id:,
            start_date:,
            end_date:,
          )

          next if row[:has_explicit_parent_budget]

          rolled_up = row[:subcategories].sum { |sub| sub[:amount].to_d }
          row[:amount] = rolled_up
          row[:budget] = rolled_up
        end
      end

      def spent_for_budget(budget:, space_id:, start_date:, end_date:)
        scope = base_transactions(space_id:, start_date:, end_date:)
                  .where(category_id: budget.category_id)

        scope = if budget.parent_budget?
                  scope
        else
                  scope.where(subcategory_id: budget.subcategory_id)
        end

        scope.sum(:amount_cents).to_d / 100
      end

      def parent_spent(category_id:, space_id:, start_date:, end_date:)
        base_transactions(space_id:, start_date:, end_date:)
          .where(category_id:)
          .sum(:amount_cents)
          .to_d / 100
      end

      def parent_only_spent(category_id:, space_id:, start_date:, end_date:)
        base_transactions(space_id:, start_date:, end_date:)
          .where(category_id:)
          .where(subcategory_id: nil)
          .sum(:amount_cents)
          .to_d / 100
      end

      def base_transactions(space_id:, start_date:, end_date:)
        Transactions::Transaction
          .calculated
          .where(space_id:)
          .where(date: start_date..end_date)
      end
    end
  end
end
