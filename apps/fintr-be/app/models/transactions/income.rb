# frozen_string_literal: true

module Transactions
  class Income < Transaction
    validates :schedule_type,
              presence: true,
              inclusion: { in: %w[one_time repeat] }
    validates :repeat_count, presence: true, if: -> { repeat? }
    validates :repeat_interval, presence: true, if: -> { repeat? }

    def value
      amount
    end

    def income
      amount
    end

    def expense
      Money.from_amount(0, amount.currency)
    end
  end
end
