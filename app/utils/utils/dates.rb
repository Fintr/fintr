# frozen_string_literal: true

module Utils
  class Dates
    class << self
      def safe_create_date(year, month, day)
        # Try to create the date with the original day
        Date.new(year, month, day)
      rescue Date::Error
        # If the day is invalid for this month, use the last day of the month
        Date.new(year, month, 1).end_of_month
      end

      def days_difference(from_date:, to_date:, timezone: "Asia/Manila")
        # Calculate the difference in days between two dates
        # Returns positive integer if to_date is after from_date
        # Returns negative integer if to_date is before from_date
        # Normalize both dates to the same timezone to avoid timezone-related issues

        # Convert both dates to the specified timezone to ensure consistent date calculation
        normalized_from = from_date.in_time_zone(timezone)
        normalized_to = to_date.in_time_zone(timezone)

        # Calculate difference using the normalized dates
        (normalized_to.to_date - normalized_from.to_date).to_i
      end

      def days_difference_absolute(from_date:, to_date:)
        # Calculate the absolute difference in days between two dates
        days_difference(from_date:, to_date:).abs
      end

      def days_difference_normalized(from_date:, to_date:, timezone: "Asia/Manila")
        # Calculate the difference in days by normalizing both dates to beginning of day
        # in the specified timezone. This is more reliable for date-only comparisons.

        normalized_from = from_date.in_time_zone(timezone).beginning_of_day
        normalized_to = to_date.in_time_zone(timezone).beginning_of_day

        ((normalized_to - normalized_from) / 1.day).round
      end
    end
  end
end
