# frozen_string_literal: true

module Transactions
  module Transfers
    class CalculatePendingBalancesJob < ApplicationJob
      queue_as :default

      def perform(date: Date.current)
        parsed_date = date.is_a?(String) ? Date.parse(date).in_time_zone("Asia/Manila") : date

        query = Transactions::Transfer.where(balance_state: "pending", date: parsed_date.beginning_of_day..parsed_date.end_of_day)

        query.find_each(batch_size: 100) do |transfer|
          Operations::Transfers::CalculateBalances.new.call(transfer_id: transfer.id)
        end
      end
    end
  end
end
