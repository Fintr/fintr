# frozen_string_literal: true

module Insights
  module Operations
    class CreateExpenseBreakdown < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transactions)
        end

        rule(:transactions) do
          key.failure("should be an array of transactions") unless values[:transactions].first.is_a?(Transactions::Transaction)
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
        expense_breakdown     = step create_expense_breakdown(expenses:)
        expense_breakdown
      end

      private

      def get_expenses(params:)
        result = params[:transactions].where(type: "Transactions::Expense")
        Success(result)
      end

      def create_expense_breakdown(expenses:)
        total_expenses = expenses.sum(:amount_cents) / 100
        result = expenses.group_by(&:category_name).map do |category_name, transactions|
          amount = transactions.sum(&:amount_cents) / 100
          percentage = Utils::Number.format_percentage((amount.to_d / total_expenses) * 100)
          {
            category_name:,
            amount: Utils::Number.format_number(amount),
            percentage:,
            currency: transactions.first.amount_currency
          }
        end
        Success(result)
      end
    end
  end
end
