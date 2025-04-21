# frozen_string_literal: true

module Transactions
  class Transaction < ApplicationRecord
    belongs_to :user, class_name: "Auth::User"
    belongs_to :space, class_name: "Spaces::Space"
    belongs_to :category, class_name: "Transactions::Category"
    belongs_to :account, class_name: "Transactions::Account"

    monetize :amount_cents, allow_nil: false
    monetize :balance_cents, allow_nil: true

    enum :schedule_type, {
      one_time: "one_time",
      repeat: "repeat"
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

    # Required field validations
    validates :date, presence: true
    validates :amount_cents, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :balance_cents, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :type, presence: true
    validates :schedule_type,
              presence: true,
              inclusion: { in: schedule_types.values }
    validates :repeat_interval, presence: true, if: -> { repeat? }
    validates :repeat_count, presence: true, if: -> { repeat? }

    def value
      amount
    end
  end
end
