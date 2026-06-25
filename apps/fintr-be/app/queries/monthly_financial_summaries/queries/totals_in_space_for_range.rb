# frozen_string_literal: true

module MonthlyFinancialSummaries
  module Queries
    # Fast path for insight totals: sums FX-based monthly buckets for full months and
    # aggregates live only for partial edges. Stale months are recalculated on read.
    class TotalsInSpaceForRange < Dry::Operation
      def self.call(space:, start_date:, end_date:, persist_stale: true)
        new.call(
          space:,
          start_date:,
          end_date:,
          persist_stale:
        )
      end

      def call(space:, start_date:, end_date:, persist_stale: true)
        earliest_transaction_date = MonthlyFinancialSummaries::Queries::EarliestTransactionDateForSpace.call(
          space:
        )
        return zeros if earliest_transaction_date.blank?

        effective_start_date = [
          start_date.to_date,
          earliest_transaction_date.beginning_of_month
        ].max
        effective_end_date = end_date.to_date
        return zeros if effective_start_date > effective_end_date

        pieces = MonthlyFinancialSummaries::Support::DateRangePieces.call(
          start_date: effective_start_date,
          end_date: effective_end_date
        )
        first = aggregate_partial(
          space:,
          start_date: pieces[:first_start],
          end_date: pieces[:first_end]
        )
        last = aggregate_partial(
          space:,
          start_date: pieces[:last_start],
          end_date: pieces[:last_end]
        )
        cache = aggregate_full_months(
          space:,
          month_dates: pieces[:full_month_dates],
          persist_stale:
        )
        combined = combine_totals(first:, last:, cache:)
        combined
      end

      private

      def aggregate_partial(space:, start_date:, end_date:)
        return Success(zeros) if start_date.blank? || end_date.blank?

        Success(
          MonthlyFinancialSummaries::Queries::AggregateTotalsInSpaceForRange.call(
            space:,
            start_date:,
            end_date:
          )
        )
      end

      def aggregate_full_months(space:, month_dates:, persist_stale:)
        return Success(zeros) if month_dates.blank?

        total_income = 0.to_d
        total_expenses = 0.to_d

        month_dates.each do |month_start|
          month_totals = totals_for_month(
            space:,
            month_start:,
            persist_stale:
          )
          total_income += month_totals[:total_income]
          total_expenses += month_totals[:total_expenses]
        end

        Success(
          {
            total_income:,
            total_expenses:,
            net_savings: total_income - total_expenses
          }
        )
      end

      def totals_for_month(space:, month_start:, persist_stale:)
        MonthlyFinancialSummaries::Queries::TotalsForMonth.call(
          space:,
          month_start:,
          persist_stale:
        )
      end

      def combine_totals(first:, last:, cache:)
        total_income = 0.to_d
        total_expenses = 0.to_d

        [first, last, cache].compact.each do |result|
          next unless result.success?

          totals = result.value!
          total_income += totals[:total_income].to_d
          total_expenses += totals[:total_expenses].to_d
        end

        {
          total_income:,
          total_expenses:,
          net_savings: total_income - total_expenses
        }
      end

      def zeros
        {
          total_income: 0.to_d,
          total_expenses: 0.to_d,
          net_savings: 0.to_d
        }
      end
    end
  end
end
