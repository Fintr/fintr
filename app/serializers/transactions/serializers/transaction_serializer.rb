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

      # Booked leg (ledger): same as +record.amount+ / +amount_currency+ for edit forms and
      # foreign-account rows where the user expects the account ISO.
      field :amount do |record|
        record.amount.amount
      end

      field :amount_currency do |record|
        record.amount_currency
      end

      # Space-context display (list/index uses {FilteredCombinedSerializer} instead).
      field :amount_in_space_currency do |record|
        payload = record.amount_in_space_currency
        {
          amount: payload[:amount],
          currency: payload[:currency]
        }
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
