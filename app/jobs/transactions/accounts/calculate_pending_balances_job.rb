# frozen_string_literal: true

module Transactions
  module Accounts
    class CalculatePendingBalancesJob < ApplicationJob
      queue_as :default

      def perform(date: Date.current)
        parsed_date = Date.parse(date) if date.is_a?(String)
        query = Transactions::Transaction.where(balance_state: "pending", date: parsed_date.beginning_of_day..parsed_date.end_of_day)

        query.find_each(batch_size: 100) do |transaction|
          params = { transaction_id: transaction.id }
          Operations::Accounts::CalculateBalance.new.call(params:)
        end
      end
    end
  end
end
