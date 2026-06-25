# frozen_string_literal: true

module Insights
  module Queries
    # Expense total for a date range using monthly FX buckets (read-only on insights paths).
    class SumExpensesInSpaceForRange
      def self.call(space:, start_date:, end_date:, persist_stale: false)
        new.call(
          space:,
          start_date:,
          end_date:,
          persist_stale:
        )
      end

      def call(space:, start_date:, end_date:, persist_stale: false)
        result = MonthlyFinancialSummaries::Queries::TotalsInSpaceForRange.call(
          space:,
          start_date:,
          end_date:,
          persist_stale:
        )
        return 0.to_d unless result.success?

        result.value![:total_expenses]
      end
    end
  end
end
