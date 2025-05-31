# frozen_string_literal: true

module Transactions
  module Transfers
    class CalculatePendingBalancesJob < ApplicationJob
      queue_as :default

      def perform
        query = Transactions::Transfer.where(balance_state: "pending", date: Time.zone.today)

        query.find_each(batch_size: 100) do |transfer|
          params = { transfer_id: transfer.id }
          Operations::Transfers::CalculateBalances.new.call(params)
        end
      end
    end
  end
end
