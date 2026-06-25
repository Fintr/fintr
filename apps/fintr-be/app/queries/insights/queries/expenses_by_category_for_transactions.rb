# frozen_string_literal: true

module Insights
  module Queries
    # FX-aware expense totals grouped by category name using SQL buckets (not per-row iteration).
    class ExpensesByCategoryForTransactions
      def self.call(transactions:, space:)
        new.call(
          transactions:,
          space:
        )
      end

      def call(transactions:, space:)
        scope = relation_for(transactions:)
        return {} if scope.blank?

        grouped_cents = scope
          .where(type: Transactions::Expense.name)
          .joins(:category)
          .group(
            "transactions_categories.name",
            :amount_currency,
            :date
          )
          .sum(:amount_cents)

        grouped_cents.each_with_object(Hash.new(0.to_d)) do |((name, currency, date), cents), totals|
          next if cents.zero?

          money = Money.new(cents, currency)
          totals[name] += Insights::SpaceCurrencyAmount.to_space_decimal(
            money:,
            date: date.to_date,
            space:,
            strict: true
          ).abs
        end
      end

      private

      def relation_for(transactions:)
        if transactions.is_a?(ActiveRecord::Relation)
          return transactions.except(:select, :order)
        end

        transaction_ids = Array(transactions).filter_map(&:id)
        return nil if transaction_ids.empty?

        Transactions::Transaction.where(id: transaction_ids)
      end
    end
  end
end
