# frozen_string_literal: true

namespace :transactions do
  desc "Calculate transactions until today"
  task calculate_until_today: :environment do
    query = Transactions::Transaction.where(balance_state: "pending", date: ..Time.zone.today)

    query.find_each(batch_size: 100) do |transaction|
      puts "Transaction: #{transaction.id}"
      params = { transaction_id: transaction.id }
      result = Transactions::Operations::Accounts::CalculateBalance.new.call(params)
      puts "result: #{result}"
    end

    query = Transactions::Transfer.where(balance_state: "pending", date: ..Time.zone.today)

    query.find_each(batch_size: 100) do |transfer|
      puts "Transfer: #{transfer.id}"
      params = { transfer_id: transfer.id }
      Transactions::Operations::Transfers::CalculateBalances.new.call(params)
    end
  end
end
