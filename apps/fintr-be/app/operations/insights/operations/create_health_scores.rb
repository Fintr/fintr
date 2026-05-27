# frozen_string_literal: true

module Insights
  module Operations
    class CreateHealthScores < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:total_income).value(:decimal)
          required(:total_expenses).value(:decimal)
          required(:net_savings).value(:decimal)
          required(:budget_records)
          required(:transactions)
          required(:space)
        end

        rule(:total_income) do
          key.failure("should be at least 0") if values[:total_income] < 0
        end

        rule(:total_expenses) do
          key.failure("should be at least 0") if values[:total_expenses] < 0
        end

        rule(:budget_records) do
          key.failure("is missing") if values[:budget_records].nil?
        end

        rule(:transactions) do
          key.failure("is missing") if values[:transactions].nil?
        end

        rule(:space) do
          key.failure("is missing") if values[:space].nil?
        end
      end

      def validate(params:)
        contract = Contract.new.call(
          budget_records: params[:budget_records],
          transactions: params[:transactions],
          space: params[:space],
          **params[:summary_structure]
        )
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params                 = step validate(params:)
        savings_percentage     = step get_savings_percentage(params:)
        debt_to_income_ratio   = step get_debt_to_income_ratio(params:)
        budget_usage           = step get_budget_usage(params:)
        financial_health_score = step calculate_financial_health_score(
          savings_percentage:,
          budget_usage:,
          debt_to_income_ratio:
        )
        health_scores          = step create_health_scores(
          savings_percentage:,
          debt_to_income_ratio:,
          budget_usage:,
          financial_health_score:
        )
        health_scores
      end

      private

      def get_savings_percentage(params:)
        if params[:total_income].zero?
          return Success(
            percentage: Utils::Number.format_percentage(0),
            score: 0,
            calculation: savings_percentage_calculation(
              params:,
              rate: 0.to_d,
              score: 0
            )
          )
        end

        result = params[:net_savings] / params[:total_income] * 100
        score = step get_savings_score(result)
        Success(
          percentage: Utils::Number.format_percentage(result),
          score:,
          calculation: savings_percentage_calculation(
            params:,
            rate: result,
            score:
          )
        )
      end

      def get_debt_to_income_ratio(params:)
        space = params[:space]
        period_days = params[:period_days] || 30
        monthly_income = monthly_income_from_period(
          total_income: params[:total_income],
          period_days:
        )

        if space.blank? || monthly_income.zero?
          return Success(
            percentage: Utils::Number.format_percentage(0),
            score: 100,
            monthly_debt: Utils::Number.format_number(0),
            calculation: debt_to_income_calculation(
              params:,
              monthly_income:,
              monthly_debt: 0.to_d,
              ratio: 0.to_d,
              score: 100
            )
          )
        end

        monthly_debt = Insights::MonthlyDebtPayments.total_for_space(space:)
        ratio = (monthly_debt / monthly_income) * 100
        score = debt_to_income_score(ratio)

        Success(
          percentage: Utils::Number.format_percentage(ratio),
          score:,
          monthly_debt: Utils::Number.format_number(monthly_debt),
          calculation: debt_to_income_calculation(
            params:,
            monthly_income:,
            monthly_debt:,
            ratio:,
            score:
          )
        )
      end

      def get_budget_usage(params:)
        usage_values = step Insights::Operations::ComputeBudgetUsage.new.call(
          budget_records: params[:budget_records],
          transactions: params[:transactions],
          space: params[:space]
        )
        if usage_values[:total_budget].zero?
          return Success(
            percentage: Utils::Number.format_percentage(0),
            score: 0,
            calculation: budget_usage_calculation(
              params:,
              usage_values:,
              usage_percentage: 0.to_d,
              score: 0
            )
          )
        end

        result = usage_values[:usage_percentage]
        score = step get_budget_usage_score(result)
        Success(
          percentage: Utils::Number.format_percentage(result),
          score:,
          calculation: budget_usage_calculation(
            params:,
            usage_values:,
            usage_percentage: result,
            score:
          )
        )
      end

      def calculate_financial_health_score(savings_percentage:, budget_usage:, debt_to_income_ratio:)
        savings_score = savings_percentage[:score]
        budget_usage_score = budget_usage[:score]
        debt_score = debt_to_income_ratio[:score]

        weighted_score = (savings_score * 0.5) + (budget_usage_score * 0.3) + (debt_score * 0.2)
        Success(Utils::Number.format_percentage(weighted_score))
      end

      def monthly_income_from_period(total_income:, period_days:)
        months = [period_days.to_d / 30, 1].max
        total_income.to_d / months
      end

      def debt_to_income_score(percentage)
        case percentage
        when 0...20 then 100
        when 20...30 then 80
        when 30...40 then 60
        when 40...50 then 40
        else 20
        end
      end

      def get_savings_score(percentage)
        result = case percentage
        when 20..Float::INFINITY then 100
        when 15...20             then 90
        when 10...15             then 75
        when 5...10              then 50
        when 1...5               then 25
        else 0
        end
        Success(result)
      end

      def get_budget_usage_score(percentage)
        result = case percentage
        when 0..100 then 100
        when 100...110 then 90
        when 110...120 then 80
        when 120...130 then 70
        when 130...140 then 60
        when 140...150 then 50
        when 150...160 then 40
        when 160...170 then 30
        when 170...180 then 20
        when 180...190 then 10
        else 0
        end
        Success(result)
      end

      def create_health_scores(
        savings_percentage:,
        debt_to_income_ratio:,
        budget_usage:,
        financial_health_score:
      )
        Success(
          savings_percentage:,
          debt_to_income_ratio:,
          budget_usage:,
          financial_health_score:,
          calculation: overall_health_score_calculation(
            savings_percentage:,
            budget_usage:,
            debt_to_income_ratio:,
            financial_health_score:
          )
        )
      end

      def calculation_input(label:, value:)
        { label:, value: }
      end

      def calculation_block(labeled_formula:, formula: nil, inputs:, notes: [])
        { labeled_formula:, formula:, inputs:, notes: }
      end

      def savings_percentage_calculation(params:, rate:, score:)
        space = params[:space]
        currency = space.currency.presence || "PHP"
        income = params[:total_income]
        expenses = params[:total_expenses]
        net = params[:net_savings]
        labeled_formula = "(Net savings ÷ Total income) × 100"
        value_formula =
          unless income.zero?
            "#{format_money(net, currency)} ÷ #{format_money(income, currency)} × 100 = #{Utils::Number.format_percentage(rate)}"
          end

        calculation_block(
          labeled_formula:,
          formula: value_formula,
          inputs: [
            calculation_input(label: "Total income", value: format_money(income, currency)),
            calculation_input(label: "Total expenses", value: format_money(expenses, currency)),
            calculation_input(label: "Net savings", value: format_money(net, currency)),
            calculation_input(label: "Savings rate (badge)", value: Utils::Number.format_percentage(rate)),
            calculation_input(label: "Health score (bar)", value: score.to_s)
          ],
          notes: [
            "The badge is your actual savings rate for the selected period.",
            "The bar is your health score (0–100) from savings rate bands: 20%+ → 100, 15–20% → 90, 10–15% → 75, 5–10% → 50, 1–5% → 25, below 1% → 0."
          ]
        )
      end

      def budget_usage_calculation(params:, usage_values:, usage_percentage:, score:)
        space = params[:space]
        currency = space.currency.presence || "PHP"
        total_budget = usage_values[:total_budget]
        total_expenses = usage_values[:total_expenses]
        labeled_formula = "Period expenses ÷ Total budget × 100"
        value_formula =
          if total_budget.zero?
            nil
          else
            "#{format_money(total_expenses, currency)} ÷ #{format_money(total_budget, currency)} × 100 = #{Utils::Number.format_percentage(usage_percentage)}"
          end

        calculation_block(
          labeled_formula:,
          formula: value_formula,
          inputs: [
            calculation_input(label: "Total budget", value: format_money(total_budget, currency)),
            calculation_input(label: "Period expenses", value: format_money(total_expenses, currency)),
            calculation_input(label: "Budget usage (badge)", value: Utils::Number.format_percentage(usage_percentage)),
            calculation_input(label: "Health score (bar)", value: score.to_s)
          ],
          notes: [
            "The badge is spend as a share of your total budget for this period.",
            "The bar is your health score: 100 at or under budget, then decreases in steps as usage rises above 100%."
          ]
        )
      end

      def debt_to_income_calculation(params:, monthly_income:, monthly_debt:, ratio:, score:)
        space = params[:space]
        currency = space.currency.presence || "PHP"
        period_days = params[:period_days] || 30
        months_in_period = [period_days.to_d / 30, 1].max
        period_income = params[:total_income]
        labeled_formula = "Monthly debt payments ÷ Monthly income × 100"
        value_formula =
          if monthly_income.zero?
            nil
          else
            "#{format_money(monthly_debt, currency)} ÷ #{format_money(monthly_income, currency)} × 100 = #{Utils::Number.format_percentage(ratio)}"
          end

        calculation_block(
          labeled_formula:,
          formula: value_formula,
          inputs: [
            calculation_input(label: "Period income", value: format_money(period_income, currency)),
            calculation_input(
              label: "Monthly income (est.)",
              value: format_money(monthly_income, currency)
            ),
            calculation_input(
              label: "Monthly debt payments",
              value: format_money(monthly_debt, currency)
            ),
            calculation_input(label: "Debt-to-income (badge)", value: Utils::Number.format_percentage(ratio)),
            calculation_input(label: "Health score (bar)", value: score.to_s)
          ],
          notes: [
            "Monthly income ≈ period income ÷ #{months_in_period.round(1)} months (#{period_days}-day range).",
            "Debt payments are estimated from active borrowed loans in this space.",
            "Health score bands: under 20% → 100, 20–30% → 80, 30–40% → 60, 40–50% → 40, 50%+ → 20."
          ]
        )
      end

      def overall_health_score_calculation(
        savings_percentage:,
        budget_usage:,
        debt_to_income_ratio:,
        financial_health_score:
      )
        savings_score = savings_percentage[:score]
        budget_score = budget_usage[:score]
        debt_score = debt_to_income_ratio[:score]
        weighted = (savings_score * 0.5) + (budget_score * 0.3) + (debt_score * 0.2)

        calculation_block(
          labeled_formula: "(Savings score × 50%) + (Budget score × 30%) + (Debt score × 20%)",
          formula: "(#{savings_score} × 0.5) + (#{budget_score} × 0.3) + (#{debt_score} × 0.2) = #{financial_health_score}",
          inputs: [
            calculation_input(label: "Savings score", value: savings_score.to_s),
            calculation_input(label: "Budget score", value: budget_score.to_s),
            calculation_input(label: "Debt score", value: debt_score.to_s),
            calculation_input(label: "Overall score", value: financial_health_score)
          ],
          notes: [
            "Each factor bar is scored 0–100; this combines them into your headline Financial Health Score."
          ]
        )
      end

      def format_money(amount, currency)
        Money.from_amount(amount.to_f, currency).format
      end
    end
  end
end
