# frozen_string_literal: true

module MonthlyFinancialSummaries
  module Queries
    class EarliestTransactionDateForSpace
      def self.call(space:)
        new.call(space:)
      end

      def call(space:)
        Transactions::Transaction
          .joins(:category)
          .where(
            space_id: space.id,
            balance_state: :calculated
          )
          .where.not(transactions_categories: { name: "Initial Balance" })
          .minimum(:date)
          &.to_date
      end
    end
  end
end
