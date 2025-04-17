# frozen_string_literal: true

module Transactions
  class Expense < Transaction
    def value
      Money.from_amount(amount.amount * -1, amount.currency)
    end
  end
end
