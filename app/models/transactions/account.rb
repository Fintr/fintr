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

    include Discard::Model

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

    scope :default, -> { where(name: DEFAULT_ACCOUNT_MAPPING.values) }

    def self.create_default_accounts(space)
      transaction do
        DEFAULT_ACCOUNT_MAPPING.each do |category, name|
          self.find_or_create_by(name:, space:, balance_currency: "PHP", account_category: category)
        end
      end
    end

    def self.account_category_options
      ACCOUNT_CATEGORY_LABELS.map do |key, value|
        {
          value: key,
          label: value
        }
      end
    end
  end
end
