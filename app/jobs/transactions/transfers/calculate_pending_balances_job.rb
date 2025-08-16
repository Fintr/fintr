# frozen_string_literal: true

module Transactions
  module Transfers
    class CalculatePendingBalancesJob < ApplicationJob
      queue_as :default

      def perform(date: Date.current)
        parsed_date = Date.parse(date) if date.is_a?(String)
        query = Transactions::Transfer.where(balance_state: "pending", date: parsed_date.beginning_of_day..parsed_date.end_of_day)

        query.find_each(batch_size: 100) do |transfer|
          Operations::Transfers::CalculateBalances.new.call(transfer_id: transfer.id)
        end
      end
    end
  end
end
