# frozen_string_literal: true

module Transactions
  class Income < Transaction
    enum :schedule_type, {
      one_time: "one_time",
      repeat: "repeat"
    }

    validates :schedule_type,
              presence: true,
              inclusion: { in: schedule_types.values }
    validates :repeat_count, presence: true, if: -> { repeat? }
    validates :repeat_interval, presence: true, if: -> { repeat? }

    def value
      amount
    end
  end
end
