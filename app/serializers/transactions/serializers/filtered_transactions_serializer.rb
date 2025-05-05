# frozen_string_literal: true

module Transactions
  module Serializers
    class FilteredTransactionsSerializer < Blueprinter::Base
      identifier :id

      fields :date,
             :description,
             :account_name,
             :category_name

      field :amount do |transaction|
        transaction.value.amount
      end

      field :balance do |transaction|
        transaction.balance.amount
      end

      field :type do |transaction|
        if transaction.type == "Transactions::Income"
          "income"
        elsif transaction.type == "Transactions::Expense"
          "expense"
        elsif transaction.type == "Transactions::Transfer"
          "transfer"
        end
      end
    end
  end
end
