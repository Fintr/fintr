# frozen_string_literal: true

module Transactions
  class DuplicateJob < ApplicationJob
    queue_as :default

    def perform(transaction_id)
      date = Utils::Dates.current_date_in_manila
      Transactions::Operations::CreateRepeatTransactions
        .new
        .call(
          transaction_id:,
          date_start: date + 1.month,
          date_end: date + 1.month
        )
      raise StandardError, "Duplicate job failed transaction id: #{transaction_id},message: #{operation.failure}" unless operation.success?
    end
  end
end
