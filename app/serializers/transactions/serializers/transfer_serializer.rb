# frozen_string_literal: true

module Transactions
  module Serializers
    class TransferSerializer < Blueprinter::Base
      identifier :id

      fields :date,
             :description,
             :amount,
             :schedule_type,
             :repeat_interval,
             :repeat_count

      field :amount do |record|
        record.amount.amount
      end

      field :amount_currency

      field :transaction_cost do |record|
        record.transaction_cost.amount
      end

      field :transaction_cost_currency do |record|
        record.transaction_cost_currency
      end

      field :to_account_name do |record|
        record.to_account.name
      end

      field :from_account_name do |record|
        record.from_account.name
      end

      field :type do
        "transfer"
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
