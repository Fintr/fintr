# frozen_string_literal: true

module Transactions
  module Serializers
    class TransactionSerializer < Blueprinter::Base
      identifier :id

      fields :date,
             :description,
             :balance,
             :schedule_type,
             :repeat_interval,
             :repeat_count,
             :installment_period,
             :installment_count

      # Single display amount: always in space currency so the frontend reads one field only.
      field :amount do |record|
        record.amount_in_space_currency[:amount]
      end

      field :amount_currency do |record|
        record.amount_in_space_currency[:currency]
      end

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

      field :has_currency_conversion do |record|
        record.has_currency_conversion?
      end

      # For edit form: when a conversion exists, expose original amount and currency so the form shows them (e.g. PLN, not space currency).
      field :original_display_amount,
        if: ->(_field_name, record, _options) { record.currency_conversion.present? } do |record|
          record.currency_conversion.original_money.amount
        end

      field :original_display_currency,
        if: ->(_field_name, record, _options) { record.currency_conversion.present? } do |record|
          record.currency_conversion.original_currency
        end

      association :currency_conversion,
        blueprint: CurrencyConversionSerializer,
        if: ->(_field_name, transaction, _options) { transaction.currency_conversion.present? }

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
