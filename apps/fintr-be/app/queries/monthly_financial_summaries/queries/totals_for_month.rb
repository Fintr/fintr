# frozen_string_literal: true

module MonthlyFinancialSummaries
  module Queries
    class TotalsForMonth
      def self.call(space:, month_start:, persist_stale: false)
        new.call(
          space:,
          month_start:,
          persist_stale:
        )
      end

      def call(space:, month_start:, persist_stale: false)
        summary = MonthlyFinancialSummary.find_by(
          space_id: space.id,
          year: month_start.year,
          month: month_start.month
        )

        if summary&.fresh? && !MonthlyFinancialSummary.totals_empty?(cached_totals(summary:))
          return cached_totals(summary:)
        end

        totals = MonthlyFinancialSummaries::Queries::AggregateTotalsInSpaceForRange.call(
          space:,
          start_date: month_start,
          end_date: month_start.end_of_month
        )

        if persist_stale && should_persist?(summary:, totals:)
          MonthlyFinancialSummary.apply_totals_for_space_and_month!(
            space:,
            year: month_start.year,
            month: month_start.month,
            totals:
          )
        end

        totals
      end

      private

      def cached_totals(summary:)
        {
          total_income: summary.total_income.to_d,
          total_expenses: summary.total_expenses.to_d,
          net_savings: summary.net_savings.to_d
        }
      end

      def should_persist?(summary:, totals:)
        summary.present? || !MonthlyFinancialSummary.totals_empty?(totals)
      end
    end
  end
end
