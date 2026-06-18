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
          attach_subcategory_spending_without_budget(
            row:,
            space_id:,
            start_date:,
            end_date:,
          )

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

        transaction_spent = scope.sum(:amount_cents).to_d / 100
        transaction_spent + loan_interest_spent_for_budget(
          budget:,
          space_id:,
          start_date:,
          end_date:,
        )
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

      def attach_subcategory_spending_without_budget(row:, space_id:, start_date:, end_date:)
        spending_by_subcategory_id = base_transactions(space_id:, start_date:, end_date:)
          .where(category_id: row[:category_id])
          .where.not(subcategory_id: nil)
          .group(:subcategory_id)
          .sum(:amount_cents)

        return if spending_by_subcategory_id.blank?

        existing_subcategory_ids = row[:subcategories].map { |sub| sub[:subcategory_id] }.compact

        spending_by_subcategory_id.each do |subcategory_id, amount_cents|
          next if existing_subcategory_ids.include?(subcategory_id)

          subcategory = Transactions::Category.find_by(id: subcategory_id)
          next if subcategory.blank?

          row[:subcategories] << subcategory_spending_only_row(
            category_id: row[:category_id],
            subcategory:,
            spent: amount_cents.to_d / 100,
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
          amount_currency: nil,
        }
      end

      def base_transactions(space_id:, start_date:, end_date:)
        Transactions::Transaction
          .calculated
          .where(space_id:)
          .where(date: start_date..end_date)
      end

      def loan_interest_spent_for_budget(budget:, space_id:, start_date:, end_date:)
        category = budget.category
        return 0.to_d unless category.name.in?(%w[Interest Expense Interest Income])

        loan_type = category.name == "Interest Expense" ? "borrowed" : "lent"

        Transactions::LoanPayment
          .joins(:loan)
          .where(loans: { space_id:, loan_type: })
          .where(date: start_date..end_date)
          .sum(:interest_payment_cents)
          .to_d / 100
      end
    end
  end
end
