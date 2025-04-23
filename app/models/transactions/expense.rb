# frozen_string_literal: true

module Transactions
  class Expense < Transaction
    validates :schedule_type,
              presence: true,
              inclusion: { in: %w[one_time repeat installment] }
    validates :installment_period, presence: true, if: -> { installment? }
    validates :installment_count, presence: true, if: -> { installment? }

    def value
      Money.from_amount(amount.amount * -1, amount.currency)
    end
  end
end
