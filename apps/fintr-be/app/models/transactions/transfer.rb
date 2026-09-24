# frozen_string_literal: true

module Transactions
  class Transfer < ApplicationRecord
    include Repeatable
    include HasCurrencyConversion
    include Versionable

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
    validates :amount_cents, presence: true, numericality: { greater_than: 0, message: "must be a positive number" }
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
      @amount_in_space_currency ||= ::ExchangeRates::Operations::AmountInSpaceForTransactable.display_payload(
        transactable: self
      )
    end

    # See {Transactions::Transaction#amount_numeric_for_space_total}.
    def amount_numeric_for_space_total
      @amount_numeric_for_space_total ||= ::ExchangeRates::Operations::AmountInSpaceForTransactable.totals_amount_decimal(
        transactable: self
      )
    end

    def total_cost
      amount + transaction_cost
    end

    # Label for the linked expense fee row (not the transfer itself).
    # With note:  "Transfer fee for: <note>, amount: <transfer amount>"
    # Without:    "Transfer fee, amount: <transfer amount>"
    def fee_transaction_description
      amount_label = fee_description_amount_label
      note = description.to_s.strip
      if note.present?
        "Transfer fee for: #{note}, amount: #{amount_label}"
      else
        "Transfer fee, amount: #{amount_label}"
      end
    end

    def income
      Money.from_amount(0, amount.currency)
    end

    def expense
      transaction_cost
    end

    # List "Show currencies" toggle: expose the shared account currency when it differs from
    # the space currency, even without a +currency_conversion+ row (e.g. USD–USD on a PHP space).
    def booked_display_for_list_toggle
      return super if has_currency_conversion?

      shared_account_booked_display_for_list_toggle
    end

    def shared_account_booked_display_for_list_toggle
      shared = ::Transactions::Operations::Transfers::BookedTransferLegMagnitude
        .effective_stored_amount_currency(transfer: self)
      shared ||= from_account&.balance_currency if from_account&.balance_currency == to_account&.balance_currency
      space_ccy = space.currency.presence || "PHP"
      return nil if shared.blank? || shared == space_ccy

      sign =
        if value.amount.negative?
          -1
        elsif value.amount.positive?
          1
        else
          1
        end

      {
        amount: (sign * amount.amount.to_d.abs).round(2),
        currency: shared.to_s
      }
    end

    private

    def fee_description_amount_label
      value = amount.amount
      return value.to_i.to_s if value == value.to_i

      value.to_s("F")
    end

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
