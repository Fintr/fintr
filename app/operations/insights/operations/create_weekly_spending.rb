# frozen_string_literal: true

module Insights
  module Operations
    class CreateWeeklySpending < Dry::Operation
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
        return [] if expenses.blank? || expenses.sum(&:expense).amount.zero?

        weekly_spending       = step create_weekly_spending(expenses:)
        weekly_spending
      end

      private

      def get_expenses(params:)
        # Get exactly 7 days: from (1.week - 1.day) ago to today
        start_date = (1.week - 1.day).ago.beginning_of_day
        end_date = Time.zone.today.end_of_day

        result = params[:transactions]
                  .where(type: %w[Transactions::Expense])
                  .where(date: start_date..end_date)
        Success(result)
      end

      def create_weekly_spending(expenses:)
        total_expenses = expenses.sum(&:expense).amount

        # Create date range for exactly 7 days: from 6 days ago to today
        start_date = 6.days.ago.beginning_of_day.to_date
        end_date = Date.current
        date_range = start_date..end_date

        # Order expenses by date and convert to array for grouping
        ordered_expenses = expenses.order(date: :asc)
        expenses_array = ordered_expenses.is_a?(Array) ? ordered_expenses : ordered_expenses.to_a
        # Group by date only, not datetime
        expenses_by_date = expenses_array.group_by { |transaction| transaction.date.to_date }

        # Create result for all 7 days, including days with no transactions
        result = date_range.map do |date|
          transactions_for_date = expenses_by_date[date] || []
          amount = if transactions_for_date.any?
                     transactions_for_date.sum(&:expense).amount
          else
                     0
          end

          percentage = if total_expenses.zero?
                         0.0
          else
                         (amount.to_d / total_expenses.to_d) * 100
          end

          # Get currency from first expense transaction, or default to 'PHP'
          currency = if transactions_for_date.any?
                       transactions_for_date.first.amount_currency
          else
                       expenses_array.first&.amount_currency || "PHP"
          end

          {
            date: date.strftime("%a"),
            amount: Utils::Number.format_number(amount),
            percentage: Utils::Number.format_percentage(percentage),
            currency: currency
          }
        end

        Success(result)
      end
    end
  end
end
