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

      created_at = record.created_at
      target_date = Date.new(reference_date.year, reference_date.month, created_at.day)
      period = target_date..(target_date + 1.month - 1.day).end_of_day
      to_string ? usage_period_string(period) : period
    end

    def self.usage_period_string(usage_period)
      format = "%B %d, %Y"
      "#{usage_period.begin.strftime(format)} - #{usage_period.end.strftime(format)}"
    end
  end
end
