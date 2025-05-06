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

    belongs_to :space, class_name: "Spaces::Space"
    has_many :transactions, dependent: :destroy

    monetize :balance_cents, allow_nil: false

    validates :name, presence: true, uniqueness: { scope: :space_id }
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
    }

    scope :default, -> { where(name: DEFAULT_ACCOUNT_MAPPING.values) }

    def self.create_default_accounts(space)
      transaction do
        DEFAULT_ACCOUNT_MAPPING.each do |category, name|
          self.find_or_create_by(name:, space:, balance_currency: "PHP", account_category: category)
        end
      end
    end
  end
end
