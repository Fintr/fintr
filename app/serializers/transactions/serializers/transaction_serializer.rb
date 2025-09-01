# frozen_string_literal: true

module Transactions
  module Serializers
    class TransactionSerializer < Blueprinter::Base
      identifier :id

      fields :date,
             :description,
             :amount,
             :balance,
             :schedule_type,
             :repeat_interval,
             :repeat_count,
             :installment_period,
             :installment_count

      field :amount do |record|
        record.amount.amount
      end

      field :amount_currency

      field :balance do |record|
        record.balance.amount
      end

      field :balance_currency

      field :category_name do |record|
        record.category.name
      end


      field :account_name do |record|
        record.account.name
      end

      field :type do |record|
        type_mapping = {
          "Transactions::Income" => "income",
          "Transactions::Expense" => "expense",
          "Transactions::Draft" => "draft"
        }

        type_mapping[record.type]
      end

      field :files do |record|
        record.files.map do |file|
          {
            id: file.id,
            filename: file.filename.to_s,
            content_type: file.content_type,
            url: file.url,
            created_at: file.created_at
          }
        end
      end
    end
  end
end
