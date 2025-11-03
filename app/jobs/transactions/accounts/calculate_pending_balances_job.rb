# frozen_string_literal: true

module Transactions
  module Accounts
    class CalculatePendingBalancesJob < ApplicationJob
      queue_as :default

      def perform(date: Utils::Dates.current_date_in_manila)
        parsed_date = date.is_a?(String) ? Date.parse(date) : date
        parsed_date = parsed_date.in_time_zone("Asia/Manila")
        query = Transactions::Transaction.where(balance_state: "pending",
                                                date: ..parsed_date.end_of_day)

        query.find_each(batch_size: 100) do |transaction|
          Operations::Accounts::CalculateBalance.new.call(transaction_id: transaction.id)
        end
      end
    end
  end
end
