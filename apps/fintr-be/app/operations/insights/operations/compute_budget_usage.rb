# frozen_string_literal: true

module Insights
  module Operations
    # Single source of truth for budget usage % (insights, budgets summary, narratives).
    class ComputeBudgetUsage < Dry::Operation
    def call(params)
      total_budget = step compute_total_budget(params:)
      total_expenses = step compute_total_expenses(params:)
      step build_summary(total_budget:, total_expenses:)
    end

    private

    def compute_total_budget(params:)
      budget_records = params[:budget_records]
      space = params[:space]
      return Success(0.to_d) if budget_records.blank?

      total = budget_records.sum do |budget|
        Insights::SpaceCurrencyAmount.to_space_decimal(
          money: budget.amount,
          date: budget.date.to_date,
          space:,
          strict: true
        )
      end
      Success(total)
    end

    def compute_total_expenses(params:)
      transactions = params[:transactions]
      return Success(0.to_d) if transactions.blank?

      total = transactions.inject(0.to_d) do |memo, transaction|
        next memo unless transaction.is_a?(Transactions::Expense)

        memo + transaction.amount_numeric_for_space_total.to_d.abs
      end
      Success(total)
    end

    def build_summary(total_budget:, total_expenses:)
      usage_percentage =
        if total_budget.zero?
          0.to_d
        else
          (total_expenses / total_budget) * 100
        end

      remaining = total_budget - total_expenses
      over_amount = remaining.negative? ? -remaining : 0.to_d

      Success(
        total_budget:,
        total_expenses:,
        usage_percentage:,
        remaining:,
        over_amount:
      )
    end
    end
  end
end
