# frozen_string_literal: true

module Insights
  module Operations
    class CreateWeeklySpending < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transactions)
        end

        rule(:transactions) do
          key.failure("should be an array of transactions") unless values[:transactions].first.is_a?(Transactions::Combined)
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
        return [] if expenses.blank? || expenses.sum(&:expense).amount.zero?

        weekly_spending       = step create_weekly_spending(expenses:)
        weekly_spending
      end

      private

      def get_expenses(params:)
        date = Time.zone.today
        result = params[:transactions]
                  .where(transactable_type: %w[Transactions::Expense Transactions::Transfer])
                  .where(date: (1.week.ago.beginning_of_day)..(date.end_of_day))
        Success(result)
      end

      def create_weekly_spending(expenses:)
        total_expenses = expenses.sum(&:expense).amount

        ordered_expenses = expenses.order(:date)

        result = ordered_expenses.group_by(&:date).map do |original_date, transactions|
          amount = transactions.sum(&:expense).amount
          percentage = if total_expenses.zero?
                         0.0
          else
                         (amount.to_d / total_expenses.to_d) * 100
          end
          {
            original_date_for_sort: original_date,
            date: original_date.strftime("%a"),
            amount: Utils::Number.format_number(amount),
            percentage: Utils::Number.format_percentage(percentage),
            currency: transactions.first.amount_currency
          }
        end.sort_by { |item| item[:original_date_for_sort] }
           .map { |item| item.except(:original_date_for_sort) }
        Success(result)
      end
    end
  end
end
