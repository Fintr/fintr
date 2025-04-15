# frozen_string_literal: true

module Transactions
  class Expense < Transaction
    def value
      amount * -1
    end
  end
end
