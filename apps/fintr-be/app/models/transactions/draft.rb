# frozen_string_literal: true

module Transactions
  class Draft < Transaction
    MAX_DRAFTS = 5

    scope :ordered, -> { order(created_at: :desc) }

    def income
      0
    end

    def expense
      0
    end
  end
end
