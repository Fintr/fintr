# frozen_string_literal: true

module Utils
  class Recurrence
    def self.schedule(repeat_interval:, date:, installment_period: nil)
      IceCube::Schedule.new(date) do |s|
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

    def self.usage_period(record:, reference_date: Date.current, to_string: false)
      raise ArgumentError, "Record must be an AR record" unless record.is_a?(ActiveRecord::Base)

      schedule = schedule(repeat_interval: "every_month", date: record.created_at)
      occurrence = schedule.occurrences(reference_date).last || reference_date
      period = occurrence.beginning_of_day..(occurrence + 1.month - 1.day).end_of_day

      to_string ? usage_period_string(period) : period
    end

    def self.usage_period_string(usage_period)
      format = "%B %d, %Y"
      "#{usage_period.begin.strftime(format)} - #{usage_period.end.strftime(format)}"
    end

    private


    def self.safe_create_date(year, month, day)
      # Try to create the date with the original day
      Date.new(year, month, day)
    rescue Date::Error
      # If the day is invalid for this month, use the last day of the month
      Date.new(year, month, 1).end_of_month
    end
  end
end
