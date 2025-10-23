# frozen_string_literal: true

module Transactions
  class DuplicateJob < ApplicationJob
    queue_as :default

    def perform(transaction_id)
      date = Time.zone.today.in_time_zone("Asia/Manila")
      Transactions::Operations::CreateRepeatTransactions
        .new
        .call(
          transaction_id:,
          date_start: date,
          date_end: date + 1.month
        )
    end
  end
end
