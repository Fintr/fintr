# frozen_string_literal: true

module MonthlyFinancialSummaries
  module Queries
    # Live FX-aware income/expense totals for any date range using grouped currency-date buckets.
    class AggregateTotalsInSpaceForRange
      INCOME_TYPE = "Transactions::Income"
      EXPENSE_TYPE = "Transactions::Expense"

      def self.call(space:, start_date:, end_date:)
        new.call(space:, start_date:, end_date:)
      end

      def call(space:, start_date:, end_date:)
        total_income = sum_type_in_space(
          space:,
          start_date:,
          end_date:,
          type: INCOME_TYPE
        )
        total_expenses = sum_type_in_space(
          space:,
          start_date:,
          end_date:,
          type: EXPENSE_TYPE
        )

        {
          total_income: total_income.to_d,
          total_expenses: total_expenses.to_d,
          net_savings: (total_income - total_expenses).to_d
        }
      end

      private

      def sum_type_in_space(space:, start_date:, end_date:, type:)
        Insights::SpaceCurrencyAmount.sum_relation_in_space(
          relation: base_scope(
            space:,
            start_date:,
            end_date:
          ).where(type: type),
          space:
        )
      end

      def base_scope(space:, start_date:, end_date:)
        Transactions::Transaction
          .joins(:category)
          .where(
            space_id: space.id,
            balance_state: :calculated,
            date: start_date.beginning_of_day..end_date.end_of_day
          )
          .where.not(transactions_categories: { name: "Initial Balance" })
      end
    end
  end
end
