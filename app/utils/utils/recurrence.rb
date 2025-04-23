# frozen_string_literal: true

module Utils
  class Recurrence
    def self.schedule(repeat_interval:, date:)
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
        end

        s.add_recurrence_rule(obj)
      end
    end
  end
end
