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
             :category_name,
             :created_at

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
          "Transactions::Transfer" => "transfer",
          "Transactions::Loan" => "loan_disbursement",
          "Transactions::LoanPayment" => "loan_payment"
        }

        type_mapping[record.transactable_type]
      end

      field :loan_id do |record|
        record.try(:loan_id)
      end

      field :entity_id do |record|
        transactable = record.transactable
        next transactable.entity_id if transactable.respond_to?(:entity_id)
        next transactable.loan.entity_id if transactable.respond_to?(:loan) && transactable.loan.present?

        nil
      end

      field :account_id do |record|
        transactable = record.transactable
        next transactable.account_id if transactable.respond_to?(:account_id)

        nil
      end

      field :from_account_id do |record|
        transactable = record.transactable
        next transactable.from_account_id if transactable.respond_to?(:from_account_id)
        next transactable.account_id if record.transactable_type == "Transactions::Expense"

        nil
      end

      field :to_account_id do |record|
        transactable = record.transactable
        next transactable.to_account_id if transactable.respond_to?(:to_account_id)
        next transactable.account_id if record.transactable_type == "Transactions::Income"

        nil
      end

      field :entity_name do |record|
        record.try(:entity_name)
      end

      field :loan_type do |record|
        record.try(:loan_type)
      end

      field :is_loan_activity do |record|
        %w[Transactions::Loan Transactions::LoanPayment].include?(record.transactable_type)
      end

      field :activitable_id do |record|
        record.transactable_id
      end

      field :in_series do |record|
        record.in_series?
      end

      field :parent_id do |record|
        transactable = record.transactable
        next nil unless transactable.respond_to?(:parent_id)

        transactable.parent_id&.to_s
      end

      field :schedule_type do |record|
        transactable = record.transactable
        next nil unless transactable.respond_to?(:schedule_type)

        transactable.schedule_type
      end

      field :repeat_interval do |record|
        transactable = record.transactable
        next nil unless transactable.respond_to?(:repeat_interval)

        transactable.repeat_interval
      end

      field :installment_period do |record|
        transactable = record.transactable
        next nil unless transactable.respond_to?(:installment_period)

        transactable.installment_period
      end

      field :installment_total do |record|
        transactable = record.transactable
        next nil unless transactable.respond_to?(:installment_total_cents)

        Utils::InstallmentPlan.series_installment_total_amount(transaction: transactable)
      end

      field :root_parent_id do |record|
        transactable = record.transactable
        next nil unless transactable.respond_to?(:parent_id)

        if transactable.parent_id.present?
          transactable.parent_id.to_s
        elsif transactable.respond_to?(:repeat?) && transactable.repeat?
          record.transactable_id.to_s
        elsif transactable.respond_to?(:installment?) && transactable.installment?
          record.transactable_id.to_s
        end
      end

      field :has_image do |record|
        record.transactable.respond_to?(:files) && record.transactable.files.attached?
      end

      field :has_loan_payment do |_record|
        false
      end

      field :calculated do |record|
        transactable = record.transactable

        if %w[Transactions::Loan Transactions::LoanPayment].include?(record.transactable_type)
          true
        else
          transactable.respond_to?(:balance_state) && transactable.balance_state == "calculated"
        end
      end

      field :subcategory_name do |record|
        transactable = record.transactable
        next nil unless transactable.respond_to?(:subcategory_id)
        next nil if transactable.subcategory_id.blank?

        transactable.subcategory&.name
      end

      field :category_id do |record|
        record.category_id
      end

      field :subcategory_id do |record|
        transactable = record.transactable
        next nil unless transactable.respond_to?(:subcategory_id)
        next nil if transactable.subcategory_id.blank?

        transactable.subcategory_id
      end

      field :tags do |record|
        transactable = record.transactable
        next [] unless transactable.respond_to?(:tags)

        Transactions::Serializers::TagSerializer.render_as_hash(transactable.tags)
      end
    end
  end
end
