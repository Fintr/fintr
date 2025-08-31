# frozen_string_literal: true

module Transactions
  module Serializers
    class FilteredCombinedSerializer < Blueprinter::Base
      identifier :id do |record|
        record.transactable_id
      end

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

      field :in_series do |record|
        record.in_series?
      end

      field :has_image do |record|
        record.transactable.files.attached?
      end
    end
  end
end
