# frozen_string_literal: true

module Transactions
  module Serializers
    class FilteredAccountActivitySerializer < Blueprinter::Base
      identifier :id

      fields :date,
             :description,
             :to_account_name,
             :from_account_name,
             :category_name,
             :activity_kind,
             :loan_id,
             :entity_name,
             :loan_type

      field :activitable_id do |record|
        record.activitable_id
      end

      field :activitable_type do |record|
        record.activitable_type
      end

      field :amount do |record|
        transactable = record.activitable
        if transactable.respond_to?(:amount_in_space_currency)
          transactable.amount_in_space_currency[:amount]
        else
          record.amount.amount
        end
      end

      field :amount_currency do |record|
        transactable = record.activitable
        if transactable.respond_to?(:amount_in_space_currency)
          transactable.amount_in_space_currency[:currency]
        else
          record.amount.currency.to_s
        end
      end

      field :booked_amount do |record|
        transactable = record.activitable
        toggle = transactable.respond_to?(:booked_display_for_list_toggle) ? transactable.booked_display_for_list_toggle : nil
        if toggle
          toggle[:amount]
        elsif transactable.respond_to?(:amount) && transactable.amount.present?
          transactable.amount.amount
        else
          record.amount.amount
        end
      end

      field :booked_amount_currency do |record|
        transactable = record.activitable
        toggle = transactable.respond_to?(:booked_display_for_list_toggle) ? transactable.booked_display_for_list_toggle : nil
        if toggle
          toggle[:currency]
        elsif transactable.respond_to?(:amount) && transactable.amount.present?
          transactable.amount.currency.to_s
        else
          record.amount.currency.to_s
        end
      end

      field :balance do |record|
        record.balance&.amount
      end

      field :type do |record|
        case record.activity_kind
        when "income", "expense", "transfer"
          record.activity_kind
        when "loan_disbursement"
          "loan_disbursement"
        when "loan_payment"
          "loan_payment"
        end
      end

      field :in_series do |record|
        record.in_series?
      end

      field :has_image do |record|
        record.activitable.respond_to?(:files) && record.activitable.files.attached?
      end

      field :has_loan_payment do |_record|
        false
      end

      field :is_loan_activity do |record|
        %w[loan_disbursement loan_payment].include?(record.activity_kind)
      end

      field :calculated do |record|
        if %w[loan_disbursement loan_payment].include?(record.activity_kind)
          true
        else
          record.activitable.respond_to?(:balance_state) &&
            record.activitable.balance_state == "calculated"
        end
      end

      field :subcategory_name do |record|
        transactable = record.activitable
        next nil unless transactable.respond_to?(:subcategory_id)
        next nil if transactable.subcategory_id.blank?

        transactable.subcategory&.name
      end
    end
  end
end
