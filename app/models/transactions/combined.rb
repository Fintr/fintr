# frozen_string_literal: true

module Transactions
  class Combined < ApplicationRecord
    self.table_name = "combined_transactions"

    belongs_to :space, class_name: "Spaces::Space"
    belongs_to :category, class_name: "Transactions::Category", optional: true
    belongs_to :from_account, class_name: "Accounts::Account", optional: true
    belongs_to :to_account, class_name: "Accounts::Account", optional: true

    belongs_to :transactable, polymorphic: true


    monetize :amount_cents, allow_nil: false
    monetize :balance_cents, allow_nil: true

    def readonly?
      true
    end

    def value
      case transactable_type
      when "Transactions::Transfer"
        transactable.amount
      when "Transactions::Income"
        transactable.amount
      when "Transactions::Expense"
        Money.from_amount(transactable.amount.amount * -1, transactable.amount.currency)
      end
    end
  end
end
