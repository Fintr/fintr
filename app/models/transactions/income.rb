# frozen_string_literal: true

module Transactions
  class Income < Transaction
    def value
      amount
    end
  end
end
