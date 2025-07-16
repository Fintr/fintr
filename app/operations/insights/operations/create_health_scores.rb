# frozen_string_literal: true

module Insights
  module Operations
    class CreateHealthScores < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:total_income).value(:decimal)
          required(:total_expenses).value(:decimal)
          required(:net_savings).value(:decimal)
          required(:budgets)
        end

        rule(:total_income) do
          key.failure("should be at least 0") if values[:total_income] < 0
        end

        rule(:total_expenses) do
          key.failure("should be at least 0") if values[:total_expenses] < 0
        end

        rule(:budgets) do
          key.failure("is missing") if values[:budgets].nil?
          key.failure("should be an array of budgets") if values[:budgets].present? && !values[:budgets].first.is_a?(Budget)
        end
      end

      def validate(params:)
        contract = Contract.new.call(budgets: params[:budgets], **params[:summary_structure])
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params                 = step validate(params:)
        savings_percentage     = step get_savings_percentage(params:)
        debt_to_income_ratio   = step get_debt_to_income_ratio(params:)
        total_budget           = step get_total_budget(params:)
        budget_adherence       = step get_budget_adherence(params:, total_budget:)
        financial_health_score = step calculate_financial_health_score(savings_percentage:, budget_adherence:)
        health_scores          = step create_health_scores(
                                        savings_percentage:,
                                        debt_to_income_ratio:,
                                        budget_adherence:,
                                        financial_health_score:
                                      )
        health_scores
      end

      private

      def get_savings_percentage(params:)
        return Success(Utils::Number.format_percentage(0)) if params[:total_income].zero?

        result = params[:net_savings] / params[:total_income] * 100
        Success(Utils::Number.format_percentage(result))
      end

      def get_debt_to_income_ratio(params:)
        Success(Utils::Number.format_decimal(0))
        # No debts yet
      end

      def get_total_budget(params:)
        return Success(0) if params[:budgets].blank?

        result = params[:budgets].sum(&:amount).amount
        Success(result)
      end

      def get_budget_adherence(params:, total_budget:)
        return Success(Utils::Number.format_percentage(0)) if total_budget.zero?

        result = (params[:total_expenses] - total_budget) / total_budget * 100
        Success(Utils::Number.format_percentage(result))
      end

      def calculate_financial_health_score(savings_percentage:, budget_adherence:)
        numeric_savings_percentage = savings_percentage.delete("%").to_d
        numeric_budget_adherence = budget_adherence.delete("%").to_d

        savings_score = get_savings_score(numeric_savings_percentage)
        adherence_score = get_budget_adherence_score(numeric_budget_adherence)

        weighted_score = (savings_score * 0.6) + (adherence_score * 0.4)
        Success(Utils::Number.format_percentage(weighted_score))
      end

      def get_savings_score(percentage)
        case percentage
        when 20..Float::INFINITY then 100
        when 15...20             then 90
        when 10...15             then 75
        when 5...10               then 50
        when 1...5               then 25
        else 0
        end
      end

      def get_budget_adherence_score(percentage)
        case percentage
        when -Float::INFINITY..0 then 100
        when 1...5               then 90
        when 5...10              then 75
        when 10...20             then 50
        when 20...30             then 25
        else 0
        end
      end

      def create_health_scores(
        savings_percentage:,
        debt_to_income_ratio:,
        budget_adherence:,
        financial_health_score:
      )
        hash = {
          savings_percentage:,
          debt_to_income_ratio:,
          budget_adherence:,
          financial_health_score:
        }
        Success(hash)
      end
    end
  end
end
