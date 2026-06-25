# frozen_string_literal: true

module MonthlyFinancialSummaries
  module Support
    # Splits a date range into partial edges and full calendar months (shared by range total queries).
    module DateRangePieces
      module_function

      def call(start_date:, end_date:)
        start_d = start_date.to_date
        end_d = end_date.to_date
        first_month = start_d.beginning_of_month
        last_month = end_d.beginning_of_month

        first_start = nil
        first_end = nil
        last_start = nil
        last_end = nil
        full_month_dates = []

        if first_month == last_month
          first_start = start_d
          first_end = end_d
        else
          if start_d != first_month
            first_start = start_d
            first_end = first_month.end_of_month
          end

          current = first_month + 1.month
          while current < last_month
            full_month_dates << current.to_date
            current += 1.month
          end
          full_month_dates.unshift(first_month) if start_d == first_month
          full_month_dates << last_month if end_d == last_month.end_of_month

          last_day = last_month.end_of_month
          if end_d != last_day
            last_start = last_month
            last_end = end_d
          end
        end

        {
          first_start:,
          first_end:,
          last_start:,
          last_end:,
          full_month_dates:
        }
      end
    end
  end
end
