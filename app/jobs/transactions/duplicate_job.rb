# frozen_string_literal: true

module Transactions
  class DuplicateJob < ApplicationJob
    queue_as :default

    def perform(transaction_id)
      Transactions::Operations::CreateRepeatTransactions
        .new
        .call(
          transaction_id:,
          date_start: Time.zone.today + 1.month,
          date_end: Time.zone.today + 1.month
        )
    end
  end
end
