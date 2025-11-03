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

      def current_date_in_manila
        # Get the current date in Asia/Manila timezone
        # This ensures the date is correct regardless of server timezone
        # Use this when you need the current date based on Manila time
        current_time_in_manila.to_date
      end

      def current_time_in_manila
        # Get the current time in Asia/Manila timezone
        # This ensures the time is correct regardless of server timezone
        # Use this when you need the current time (not just date) based on Manila time
        Time.zone.now.in_time_zone("Asia/Manila")
      end
    end
  end
end
