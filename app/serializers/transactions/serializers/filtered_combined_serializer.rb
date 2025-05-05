# frozen_string_literal: true

module Transactions
  module Serializers
    class FilteredCombinedSerializer < Blueprinter::Base
      identifier :id

      fields :date,
             :description,
             :to_account_name,
             :from_account_name,
             :category_name

      field :amount do |record|
        record.value&.amount
      end

      field :balance do |record|
        record.balance&.amount
      end

      field :type do |record|
        if record.transactable_type == "Transactions::Income"
          "income"
        elsif record.transactable_type == "Transactions::Expense"
          "expense"
        elsif record.transactable_type == "Transactions::Transfer"
          "transfer"
        end
      end
    end
  end
end
