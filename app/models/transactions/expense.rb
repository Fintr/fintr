# frozen_string_literal: true

module Transactions
  class Expense < Transaction
    enum :schedule_type, {
      one_time: "one_time",
      repeat: "repeat",
      installment: "installment"
    }

    validates :schedule_type,
              presence: true,
              inclusion: { in: schedule_types.values }
    validates :installment_period, presence: true, if: -> { installment? }
    validates :installment_count, presence: true, if: -> { installment? }

    def value
      Money.from_amount(amount.amount * -1, amount.currency)
    end
  end
end
