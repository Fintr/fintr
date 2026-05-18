# frozen_string_literal: true

module Insights
  module Operations
    class CreateExpenseBreakdown < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transactions)
          required(:space).value(:any)
        end

        rule(:transactions) do
          is_relation = values[:transactions].is_a?(ActiveRecord::Relation)
          is_record_transaction = values[:transactions].first.is_a?(Transactions::Transaction)
          key.failure("should be a relation of transactions") unless is_relation || is_record_transaction
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params                = step validate(params:)
        expenses              = step get_expenses(params:)
        expense_breakdown     = step create_expense_breakdown(params:, expenses:)
        expense_breakdown
      end

      private

      def get_expenses(params:)
        result = params[:transactions].where(type: %w[Transactions::Expense])
        Success(result)
      end

      def create_expense_breakdown(params:, expenses:)
        return Success([]) if expenses.empty?

        space = params[:space]
        total_expenses = Insights::SpaceCurrencyAmount.sum_booked_expenses_in_space(
          expenses:,
          space:
        )

        return Success([]) if total_expenses.zero?

        display_currency = space.currency.presence || "PHP"

        result = expenses
                  .group_by { |t| t.respond_to?(:category_name) ? t.category_name : t.category.name }
                  .map do |category_name, transactions|
          amount = Insights::SpaceCurrencyAmount.sum_booked_expenses_in_space(
            expenses: transactions,
            space:
          )
          percentage = Utils::Number.format_percentage((amount / total_expenses) * 100)
          {
            category_name:,
            amount: Utils::Number.format_number(amount),
            percentage:,
            currency: display_currency
          }
        end
        Success(result)
      end
    end
  end
end
