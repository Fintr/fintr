# frozen_string_literal: true

module Insights
  module Operations
    class CreateWeeklySpending < Dry::Operation
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
        params   = step validate(params:)
        expenses = step get_expenses(params:)
        return [] if expenses.blank?

        space = params[:space]
        total_expenses = Insights::SpaceCurrencyAmount.sum_booked_expenses_in_space(
          expenses:,
          space:
        )
        return [] if total_expenses.zero?

        step create_weekly_spending(params:, expenses:, total_expenses:)
      end

      private

      def get_expenses(params:)
        start_date = (1.week - 1.day).ago.beginning_of_day
        end_date = Time.zone.today.end_of_day

        result = params[:transactions]
                  .where(type: %w[Transactions::Expense])
                  .where(date: start_date..end_date)
        Success(result)
      end

      def create_weekly_spending(params:, expenses:, total_expenses:)
        space = params[:space]
        display_currency = space.currency.presence || "PHP"

        start_date = 6.days.ago.beginning_of_day.to_date
        end_date = Date.current
        date_range = start_date..end_date

        ordered_expenses = expenses.order(date: :asc)
        expenses_array = ordered_expenses.is_a?(Array) ? ordered_expenses : ordered_expenses.to_a
        expenses_by_date = expenses_array.group_by { |transaction| transaction.date.to_date }

        result = date_range.map do |date|
          transactions_for_date = expenses_by_date[date] || []
          amount = if transactions_for_date.any?
                     Insights::SpaceCurrencyAmount.sum_booked_expenses_in_space(
                       expenses: transactions_for_date,
                       space:
                     )
          else
                     0.to_d
          end

          percentage = if total_expenses.zero?
                         0.0
          else
                         (amount / total_expenses) * 100
          end

          {
            date: date.strftime("%a"),
            amount: Utils::Number.format_number(amount),
            percentage: Utils::Number.format_percentage(percentage),
            currency: display_currency
          }
        end

        Success(result)
      end
    end
  end
end
