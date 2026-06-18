# frozen_string_literal: true

module Transactions
  class Account < ApplicationRecord
    DEFAULT_ACCOUNT_MAPPING = {
      cash: "Cash",
      savings: "Savings",
      debit: "Debit Card",
      credit_card: "Credit Card",
      e_wallet: "E-Wallet"
    }.freeze
    ACCOUNT_CATEGORY_LABELS = {
      cash: "Cash",
      savings: "Savings",
      debit: "Debit Card",
      credit_card: "Credit Card",
      e_wallet: "E-Wallet",
      loan: "Loan",
      investment: "Investment"
    }.freeze

    # Liquid cash categories included in the "Cash only" accounts total.
    CASH_TOTAL_CATEGORIES = %w[
      cash
      savings
      debit
      e_wallet
    ].freeze

    # Liability categories included in the "Payable (Credit card)" accounts total.
    PAYABLE_TOTAL_CATEGORIES = %w[
      credit_card
    ].freeze

    include Discard::Model
    include Versionable

    belongs_to :space, class_name: "Spaces::Space"
    has_many :transactions, dependent: nil

    monetize :balance_cents, allow_nil: false

    validates :name, presence: true
    validates :name, uniqueness: {
      scope: :space_id,
      conditions: -> { where(discarded_at: nil) }
    }
    validates :balance_cents, presence: true
    validates :balance_currency, presence: true

    enum :account_category, {
      cash: "cash",
      savings: "savings",
      debit: "debit",
      credit_card: "credit_card",
      e_wallet: "e_wallet",
      loan: "loan",
      investment: "investment"
    } # Change ACCOUNT_CATEGORY_LABELS to match the enum values

    def self.account_category_options
      ACCOUNT_CATEGORY_LABELS.map do |key, value|
        {
          value: key,
          label: value
        }
      end
    end

    def self.cash_total_category?(category)
      CASH_TOTAL_CATEGORIES.include?(category.to_s)
    end

    def self.payable_total_category?(category)
      PAYABLE_TOTAL_CATEGORIES.include?(category.to_s)
    end
  end
end
