# frozen_string_literal: true

module Transactions
  class DuplicateJob < ApplicationJob
    queue_as :default

    def perform(transaction_id, date_string = nil)
      date = if date_string.present?
               Date.parse(date_string)
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
        error_message = "Duplicate job failed transaction id: #{transaction_id}, message: #{operation.failure}"
        Rails.logger.error(error_message)
        raise StandardError, error_message
      end
    end
  end
end
