# frozen_string_literal: true

module Transactions
  class Account < ApplicationRecord
    DEFAULT_ACCOUNT_NAMES = %w[Cash Credit\ Card Debit\ Card Bank\ Transfer E-Wallet].freeze

    belongs_to :space, class_name: "Spaces::Space"
    has_many :transactions, dependent: :destroy

    monetize :balance_cents, allow_nil: false

    validates :name, presence: true, uniqueness: { scope: :space_id }
    validates :balance_cents, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :balance_currency, presence: true

    scope :default, -> { where(name: DEFAULT_ACCOUNT_NAMES) }

    def self.create_default_accounts(space)
      transaction do
        DEFAULT_ACCOUNT_NAMES.each do |name|
          self.find_or_create_by(name:, space:)
        end
      end
    end
  end
end
