# frozen_string_literal: true

module Transactions
  module Serializers
    class FilteredTransactions < Blueprinter::Base
      identifier :id

      fields :date,
             :description,
             :account_name,
             :category_name

      field :amount do |transaction|
        transaction.amount.amount
      end

      field :balance do |transaction|
        transaction.balance.amount
      end

      field :type do |transaction|
        if transaction.type == "Transactions::Income"
          "income"
        elsif transaction.type == "Transactions::Expense"
          "expense"
        end
      end
    end
  end
end
