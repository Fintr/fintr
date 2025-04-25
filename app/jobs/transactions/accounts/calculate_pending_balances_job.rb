# frozen_string_literal: true

module Transactions
  module Accounts
    class CalculatePendingBalancesJob < ApplicationJob
      queue_as :default

      def perform
        query = Transactions::Transaction.where(balance_state: "pending", date: Time.zone.today)

        query.find_each(batch_size: 100) do |transaction|
          params = { transaction_id: transaction.id }
          Operations::CalculateBalance.new.call(params:)
        end
      end
    end
  end
end
