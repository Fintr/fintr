# frozen_string_literal: true

module Transactions
  class Category < ApplicationRecord
    self.table_name = "transactions_categories"

    DEFAULT_INCOME_CATEGORIES = %w[Salary Freelance Business].freeze
    DEFAULT_EXPENSE_CATEGORIES = %w[
      Family Insurance Home Utilities Food\ &\ Groceries Transport Pet Subscriptions\ &\ Hobbies
      Dine\ Out\ &\ Entertainment Travel\ &\ Vacations Shopping
    ].freeze
    UNINCLUDED_INCOME_CATEGORIES = %w[Initial\ Balance]
    UNINCLUDED_EXPENSE_CATEGORIES = %w[Transfer\ Fee]

    belongs_to :space, class_name: "Spaces::Space"
    has_many :transactions, class_name: "Transactions::Transaction", foreign_key: "category_id", dependent: :restrict_with_error

    enum :category_type, { income: "income", expense: "expense" }

    validates :name, presence: true, uniqueness: { scope: [:space_id, :category_type], message: "already exists for this space and type" }

    scope :income, -> { where(category_type: :income).where.not(name: UNINCLUDED_INCOME_CATEGORIES) }
    scope :expense, -> { where(category_type: :expense).where.not(name: UNINCLUDED_EXPENSE_CATEGORIES) }

    def self.create_default_categories(space)
      transaction do
        (DEFAULT_INCOME_CATEGORIES + ["Initial Balance"]).each do |name| # 'Initial Balance' should not be selected by user anytime
          self.find_or_create_by(name:, category_type: "income", space:)
        end

        (["Transfer Fee"]).each do |name| # 'Transfer' should not be selected by user anytime
          self.find_or_create_by(name:, category_type: "expense", space:)
        end
      end
    end
  end
end
