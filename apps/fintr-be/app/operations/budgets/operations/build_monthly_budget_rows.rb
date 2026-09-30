# frozen_string_literal: true

module Budgets
  module Operations
    class BuildMonthlyBudgetRows < Dry::Operation
      def call(budgets:, space_id:, start_date:, end_date:)
        step build_rows(budgets:, space_id:, start_date:, end_date:)
      end

      private

      def build_rows(budgets:, space_id:, start_date:, end_date:)
        space = Spaces::Space.find_by(id: space_id)
        return Failure(space_id: "not found") if space.blank?

        rows_by_parent = {}

        budgets.each do |budget|
          spent = spent_for_budget(
            budget:,
            space:,
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
                space:,
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
          space:,
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

      def finalize_parent_rows(rows_by_parent, space:, start_date:, end_date:)
        rows_by_parent.each_value do |row|
          attach_subcategory_spending_without_budget(
            row:,
            space:,
            start_date:,
            end_date:,
          )

          next if row[:subcategories].blank?

          row[:parent_only_spent] = parent_only_spent(
            category_id: row[:category_id],
            space:,
            start_date:,
            end_date:,
          )

          next if row[:has_explicit_parent_budget]

          rolled_up = row[:subcategories].sum { |sub| sub[:amount].to_d }
          row[:amount] = rolled_up
          row[:budget] = rolled_up
        end
      end

      def spent_for_budget(budget:, space:, start_date:, end_date:)
        scope = base_transactions(
          space_id: space.id,
          start_date:,
          end_date:
        ).where(category_id: budget.category_id)

        scope = if budget.parent_budget?
                  scope
        else
                  scope.where(subcategory_id: budget.subcategory_id)
        end

        sum_in_space_currency(
          scope:,
          space:
        )
      end

      def parent_spent(category_id:, space:, start_date:, end_date:)
        sum_in_space_currency(
          scope: base_transactions(
            space_id: space.id,
            start_date:,
            end_date:
          ).where(category_id:),
          space:
        )
      end

      def parent_only_spent(category_id:, space:, start_date:, end_date:)
        sum_in_space_currency(
          scope: base_transactions(
            space_id: space.id,
            start_date:,
            end_date:
          ).where(category_id:)
           .where(subcategory_id: nil),
          space:
        )
      end

      def attach_subcategory_spending_without_budget(row:, space:, start_date:, end_date:)
        spending_by_subcategory_id = spent_by_subcategory_id(
          scope: base_transactions(
            space_id: space.id,
            start_date:,
            end_date:
          ).where(category_id: row[:category_id]),
          space:
        )

        return if spending_by_subcategory_id.blank?

        existing_subcategory_ids = row[:subcategories].map { |sub| sub[:subcategory_id] }.compact

        spending_by_subcategory_id.each do |subcategory_id, spent|
          next if existing_subcategory_ids.include?(subcategory_id)

          subcategory = Transactions::Category.find_by(id: subcategory_id)
          next if subcategory.blank?

          row[:subcategories] << subcategory_spending_only_row(
            category_id: row[:category_id],
            subcategory:,
            spent:,
          )
        end
      end

      def subcategory_spending_only_row(category_id:, subcategory:, spent:)
        {
          id: nil,
          category_id:,
          subcategory_id: subcategory.id,
          subcategory_name: subcategory.name,
          amount: 0,
          budget: 0,
          spent:,
          date: nil,
          amount_currency: nil
        }
      end

      def base_transactions(space_id:, start_date:, end_date:)
        Transactions::Transaction
          .calculated
          .where(space_id:)
          .where(date: start_date..end_date)
      end

      def sum_in_space_currency(scope:, space:)
        Insights::SpaceCurrencyAmount.sum_relation_in_space(
          relation: scope,
          space:
        )
      end

      def spent_by_subcategory_id(scope:, space:)
        grouped_cents = scope
          .where.not(subcategory_id: nil)
          .group(:subcategory_id, :amount_currency, :date)
          .sum(:amount_cents)

        grouped_cents.each_with_object(Hash.new(0.to_d)) do |(group, cents), totals|
          subcategory_id, currency, date = group
          totals[subcategory_id] += Insights::SpaceCurrencyAmount.cents_in_space(
            cents:,
            currency:,
            date:,
            space:
          )
        end
      end
    end
  end
end
