# frozen_string_literal: true

class DuplicateTransactionJob < ApplicationJob
  queue_as :default

  def perform(transaction_id)
    CreateRepeatTransactions.new.call(transaction_id:, date_end: Date.current)
  end
end
