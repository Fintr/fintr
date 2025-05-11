# frozen_string_literal: true

module Budgets
  module Operations
    class PrepareMonthlyReport < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_code).value(:string)
          required(:date).value(:date)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        @space = Spaces::Space.find_by(code: params[:space_code])
        return Failure(space_code: "Not found") if @space.blank?

        Success(contract.to_h)
      end

      attr_reader :space

      def call(params)
        params                = step validate(params:)
        monthly_budgets_query = step fetch_monthly_budgets(params:)
        output                = step process_monthly_budgets(monthly_budgets_query)

        Success(output)
      end

      def fetch_monthly_budgets(params:)
        Budgets::Queries::MonthlyBudgets.call(params:)
      end

      def process_monthly_budgets(monthly_budgets_query)
        monthly_budgets_array = monthly_budgets_query.to_a
        currency_code = monthly_budgets_array.first&.amount_currency

        total_budget = monthly_budgets_array.sum(&:amount_cents) / 100.to_d

        # Ensure total_spent is treated as a BigDecimal for sum to handle potential nils gracefully
        sum_of_total_spent_main_unit = monthly_budgets_array.sum do |b|
          b.respond_to?(:total_spent) && !b.total_spent.nil? ? BigDecimal(b.total_spent.to_s) : BigDecimal(0)
        end
        total_spent = (sum_of_total_spent_main_unit).round.to_i

        remaining = total_budget - total_spent

        output = {
          budgets: Budgets::Serializers::MonthlyBudgetsSerializer.render_as_hash(monthly_budgets_array),
          summary: {
            total_budget: total_budget.round.to_i,
            total_spent: total_spent.round.to_i,
            total_spent_percentage: (total_spent / total_budget * 100).round(2),
            remaining: remaining.round.to_i
          }
        }
        Success(output)
      end
    end
  end
end
