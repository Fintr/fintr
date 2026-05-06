# frozen_string_literal: true

module Utils
  class Recurrence
    class << self
      def schedule(repeat_interval:, date:, installment_period: nil)
        # Ensure consistent timezone handling by converting to beginning of day in UTC
        start_time = date.is_a?(Date) ? date.beginning_of_day : date
        IceCube::Schedule.new(start_time) do |s|
          obj = case repeat_interval.to_sym
          when :every_day
            IceCube::Rule.daily
          when :every_week
            IceCube::Rule.weekly
          when :every_2_weeks
            IceCube::Rule.weekly(2)
          when :every_month
            IceCube::Rule.monthly
          when :every_2_months
            IceCube::Rule.monthly(2)
          when :every_3_months
            IceCube::Rule.monthly(3)
          when :every_6_months
            IceCube::Rule.monthly(6)
          when :every_year
            IceCube::Rule.yearly
          when :installment
            IceCube::Rule.monthly.count(installment_period)
          end

          s.add_recurrence_rule(obj)
        end
      end

      def usage_period(record:, reference_date: Date.current, column: :created_at, to_string: false)
        raise ArgumentError, "Record must be an AR record" unless record.is_a?(ActiveRecord::Base)

        schedule = schedule(repeat_interval: "every_month", date: record.public_send(column))
        occurrence = schedule.occurrences(reference_date).last || reference_date
        period = occurrence.beginning_of_day..(occurrence + 1.month - 1.day).end_of_day

        to_string ? usage_period_string(period) : period
      end

      def usage_period_string(usage_period)
        format = "%B %d, %Y"
        "#{usage_period.begin.strftime(format)} - #{usage_period.end.strftime(format)}"
      end
    end
  end
end
