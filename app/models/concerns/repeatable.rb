# frozen_string_literal: true

module Repeatable
  extend ActiveSupport::Concern

  included do
    enum :schedule_type, {
      one_time: "one_time",
      repeat: "repeat",
      installment: "installment"
    }

    enum :repeat_interval, {
      every_day: "every_day",
      every_week: "every_week",
      every_2_weeks: "every_2_weeks",
      every_month: "every_month",
      every_2_months: "every_2_months",
      every_3_months: "every_3_months",
      every_6_months: "every_6_months",
      every_year: "every_year"
    }

    validates :schedule_type,
              presence: true,
              inclusion: { in: schedule_types.values }
    validates :repeat_interval, presence: true, if: -> { repeat? }
    validates :repeat_count, presence: true, if: -> { repeat? }
  end
end
