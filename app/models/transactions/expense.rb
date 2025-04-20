# frozen_string_literal: true

module Transactions
  class Expense < Transaction
    enum :expense_type, {
      one_time: "one_time",
      repeat: "repeat",
      installment: "installment"
    }

    validates :expense_type,
              presence: true,
              inclusion: { in: expense_types.values }
    validates :repeat_interval, presence: true, if: -> { repeat? }
    validates :repeat_count, presence: true, if: -> { repeat? }
    validates :installment_period, presence: true, if: -> { installment? }
    validates :installment_count, presence: true, if: -> { installment? }

    def value
      Money.from_amount(amount.amount * -1, amount.currency)
    end
  end
end
