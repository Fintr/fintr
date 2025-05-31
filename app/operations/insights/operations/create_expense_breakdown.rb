# frozen_string_literal: true

module Insights
  module Operations
    class CreateExpenseBreakdown < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transactions)
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
        expense_breakdown     = step create_expense_breakdown(expenses:)
        expense_breakdown
      end

      private

      def get_expenses(params:)
        result = params[:transactions].where(type: %w[Transactions::Expense])
        Success(result)
      end

      def create_expense_breakdown(expenses:)
        # Handle the case where there are no expenses or transfers
        return Success([]) if expenses.empty?

        total_expenses = expenses.sum(&:expense).amount

        # Handle case where total_expenses is zero (e.g., only transfers, which have expense: Money.zero)
        return Success([]) if total_expenses.zero?

        result = expenses
                  .group_by { |t| t.category&.name }
                  .map do |category_name, transactions|
          amount = transactions.sum(&:expense).amount
          # Handle division by zero if amount is > 0 but total_expenses is 0 (shouldn't happen with above guard)
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
