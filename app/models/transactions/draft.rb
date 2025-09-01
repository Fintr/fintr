# frozen_string_literal: true

module Transactions
  class Draft < Transaction
    MAX_DRAFTS = 5

    scope :ordered, -> { order(created_at: :desc) }
  end
end
