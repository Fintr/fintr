# frozen_string_literal: true

module Transactions
  class Transfer < ApplicationRecord
    belongs_to :user, class_name: "Auth::User"
    belongs_to :space, class_name: "Spaces::Space"
    belongs_to :from_account, class_name: "Transactions::Account"
    belongs_to :to_account, class_name: "Transactions::Account"
    belongs_to :parent, class_name: "Transactions::Transfer", optional: true
    has_many :children, class_name: "Transactions::Transfer", foreign_key: :parent_id

    include Repeatable

    monetize :amount_cents, allow_nil: false
    monetize :transaction_cost_cents, allow_nil: false

    validates :date, presence: true
    validates :amount_cents, presence: true, numericality: { greater_than: 0 }
    validates :transaction_cost_cents, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :balance_state, presence: true, inclusion: { in: Transaction.balance_states.values }

    validate :accounts_belong_to_same_space
    validate :accounts_are_different
    validate :currencies_match

    def value
      amount
    end

    def total_cost
      amount + transaction_cost
    end

    def income
      Money.from_amount(0, amount.currency)
    end

    def expense
      transaction_cost
    end

    private

    def accounts_belong_to_same_space
      return if from_account&.space_id == to_account&.space_id

      errors.add(:base, "Both accounts must belong to the same space")
    end

    def accounts_are_different
      return if from_account_id != to_account_id

      errors.add(:base, "Cannot transfer to the same account")
    end

    def currencies_match
      return if from_account&.balance_currency == to_account&.balance_currency

      errors.add(:base, "Account currencies must match")
    end
  end
end
