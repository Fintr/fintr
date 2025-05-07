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
        type_mapping = {
          "Transactions::Income" => "income",
          "Transactions::Expense" => "expense",
          "Transactions::Transfer" => "transfer"
        }

        type_mapping[record.transactable_type]
      end
    end
  end
end
