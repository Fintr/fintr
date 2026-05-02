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

      # Single display amount: always in space currency (backend decides; frontend reads one field).
      field :amount do |record|
        record.transactable.respond_to?(:amount_in_space_currency) ? record.transactable.amount_in_space_currency[:amount] : record.value&.amount
      end

      field :amount_currency do |record|
        record.transactable.respond_to?(:amount_in_space_currency) ? record.transactable.amount_in_space_currency[:currency] : record.transactable.try(:amount_currency)
      end

      # Ledger / native leg (for UI toggle vs space-normalized +amount+ above). When a persisted
      # +currency_conversion+ exists, use the user's original entry (not the converted account leg).
      field :booked_amount do |record|
        t = record.transactable
        toggle = t.respond_to?(:booked_display_for_list_toggle) ? t.booked_display_for_list_toggle : nil
        if toggle
          toggle[:amount]
        elsif t.respond_to?(:amount) && t.amount.present?
          t.amount.amount
        else
          record.value&.amount
        end
      end

      field :booked_amount_currency do |record|
        t = record.transactable
        toggle = t.respond_to?(:booked_display_for_list_toggle) ? t.booked_display_for_list_toggle : nil
        if toggle
          toggle[:currency]
        elsif t.respond_to?(:amount) && t.amount.present?
          t.amount.currency.to_s
        elsif t.respond_to?(:amount_currency)
          t.amount_currency.to_s
        end
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

      field :has_loan_payment do |record|
        record.transactable.respond_to?(:loan_payment) && record.transactable.loan_payment.present?
      end

      field :calculated do |record|
        record.transactable.respond_to?(:balance_state) && record.transactable.balance_state == "calculated"
      end
    end
  end
end
