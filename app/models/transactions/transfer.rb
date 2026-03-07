# frozen_string_literal: true

module Transactions
  class Transfer < ApplicationRecord
    include Repeatable
    include HasCurrencyConversion

    belongs_to :user, class_name: "Auth::User"
    belongs_to :space, class_name: "Spaces::Space"
    belongs_to :from_account, class_name: "Transactions::Account"
    belongs_to :to_account, class_name: "Transactions::Account"
    belongs_to :parent, class_name: "Transactions::Transfer", optional: true
    belongs_to :effective_parent, class_name: "Transactions::Transfer", optional: true
    has_many :children, class_name: "Transactions::Transfer", foreign_key: :parent_id, dependent: :nullify
    has_many :effective_children, class_name: "Transactions::Transfer", foreign_key: :effective_parent_id, dependent: :nullify
    has_many :fee_transactions, class_name: "Transactions::Transaction", foreign_key: :transfer_id, dependent: :nullify

    has_many_attached :files
    has_one :rag_embedding, class_name: "Ai::RagEmbedding", as: :embeddable, dependent: :destroy

    monetize :amount_cents, allow_nil: false
    monetize :transaction_cost_cents, allow_nil: false

    validates :date, presence: true
    validates :amount_cents, presence: true, numericality: { greater_than: 0 }
    validates :transaction_cost_cents, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :balance_state, presence: true, inclusion: { in: Transaction.balance_states.values }

    validate :accounts_belong_to_same_space
    validate :accounts_are_different
    validate :currencies_match

    scope :ordered, ->(direction: :asc) { order(date: direction) }


    def value
      amount
    end

    # Amount and currency to show in UI: always in space currency (same contract as Transaction).
    def amount_in_space_currency
      @amount_in_space_currency ||= begin
        result = ::ExchangeRates::Operations::AmountInSpaceCurrency.new.call(
          amount: amount.amount,
          amount_currency: amount_currency,
          date: date,
          space: space
        )
        result.success? ? result.value! : { amount: amount.amount, currency: amount_currency }
      end
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
      return if currency_conversion.present?

      errors.add(:base, "Account currencies must match or exchange rate must be provided")
    end
  end
end
