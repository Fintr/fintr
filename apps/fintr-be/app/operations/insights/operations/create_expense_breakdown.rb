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

        grouped = expenses.group_by { |t| t.category_id }

        result = grouped.map do |_category_id, category_transactions|
          parent_name = parent_name_for(category_transactions.first)
          amount = Insights::SpaceCurrencyAmount.sum_booked_expenses_in_space(
            expenses: category_transactions,
            space:
          )
          percentage = Utils::Number.format_percentage((amount / total_expenses) * 100)
          subcategory_breakdown = subcategory_rows(
            transactions: category_transactions,
            space:,
            parent_total: amount,
            display_currency:
          )

          {
            category_name: parent_name,
            amount: Utils::Number.format_number(amount),
            percentage:,
            currency: display_currency,
            subcategory_breakdown:
          }
        end

        Success(result)
      end

      def parent_name_for(transaction)
        if transaction.respond_to?(:category_name) && transaction.category_name.present?
          return transaction.category_name
        end

        transaction.category.name
      end

      def subcategory_rows(transactions:, space:, parent_total:, display_currency:)
        with_sub = transactions.select { |t| subcategory_id_for(t).present? }
        return [] if with_sub.empty?

        with_sub
          .group_by { |t| subcategory_id_for(t) }
          .map do |_sub_id, sub_transactions|
            sub_name = subcategory_name_for(sub_transactions.first)
            sub_amount = Insights::SpaceCurrencyAmount.sum_booked_expenses_in_space(
              expenses: sub_transactions,
              space:
            )
            {
              subcategory_name: sub_name,
              amount: Utils::Number.format_number(sub_amount),
              percentage: Utils::Number.format_percentage((sub_amount / parent_total) * 100),
              currency: display_currency
            }
          end
      end

      def subcategory_id_for(transaction)
        return transaction.subcategory_id if transaction.respond_to?(:subcategory_id)

        nil
      end

      def subcategory_name_for(transaction)
        if transaction.respond_to?(:subcategory_name) && transaction.subcategory_name.present?
          return transaction.subcategory_name
        end

        transaction.subcategory&.name
      end
    end
  end
end
