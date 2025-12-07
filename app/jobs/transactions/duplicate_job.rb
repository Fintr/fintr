# frozen_string_literal: true

module Transactions
  class DuplicateJob < ApplicationJob
    queue_as :default

    def perform(transaction_id, date_string = nil)
      date = if date_string.present?
               Date.parse(date_string).in_time_zone("Asia/Manila")
             else
               Utils::Dates.current_date_in_manila
             end

      operation = Transactions::Operations::CreateRepeatTransactions
                    .new
                    .call(
                      transaction_id:,
                      date_start: date + 1.month,
                      date_end: date + 1.month
                    )

      unless operation.success?
        Rails.logger.error(
          "Duplicate job failed transaction id: #{transaction_id}, message: #{operation.failure}"
        )
      end
    end
  end
end
