# frozen_string_literal: true

module Transactions
  class Category < ApplicationRecord
    self.table_name = "transactions_categories"

    DEFAULT_INCOME_CATEGORIES = %w[Salary Freelance Business].freeze
    DEFAULT_EXPENSE_CATEGORIES = %w[
      Myself Family Insurance Home Utilities Food Transport Pet Subscriptions
      Going\ Out Travel Shopping
    ].freeze

    belongs_to :space, class_name: "Spaces::Space"

    enum :category_type, { income: "income", expense: "expense" }

    validates :name, presence: true, uniqueness: { scope: [ :space_id, :category_type ], message: "already exists for this space and type" }

    scope :income, -> { where(category_type: :income) }
    scope :expense, -> { where(category_type: :expense) }

    def self.create_default_categories(space)
      transaction do
        DEFAULT_INCOME_CATEGORIES.each do |name|
          self.find_or_create_by(name:, category_type: "income", space:)
        end

        DEFAULT_EXPENSE_CATEGORIES.each do |name|
          self.find_or_create_by(name:, category_type: "expense", space:)
        end
      end
    end
  end
end
