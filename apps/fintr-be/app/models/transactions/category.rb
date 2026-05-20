# frozen_string_literal: true

module Transactions
  class Category < ApplicationRecord
    self.table_name = "transactions_categories"

    DEFAULT_INCOME_CATEGORIES = %w[Salary Freelance Business].freeze
    DEFAULT_EXPENSE_CATEGORIES = %w[
      Family Insurance Home Utilities Food\ &\ Groceries Transport Pet Subscriptions\ &\ Hobbies
      Dine\ Out\ &\ Entertainment Travel\ &\ Vacations Shopping
    ].freeze
    UNINCLUDED_INCOME_CATEGORIES = %w[Initial\ Balance Income\ Adjustment]
    UNINCLUDED_EXPENSE_CATEGORIES = %w[Transfer\ Fee Expense\ Adjustment]

    belongs_to :space, class_name: "Spaces::Space"
    belongs_to :parent,
               class_name: "Transactions::Category",
               optional: true
    has_many :children,
             class_name: "Transactions::Category",
             foreign_key: :parent_id,
             dependent: :restrict_with_error,
             inverse_of: :parent
    has_many :transactions,
             class_name: "Transactions::Transaction",
             foreign_key: "category_id",
             dependent: :restrict_with_error
    has_many :subcategory_transactions,
             class_name: "Transactions::Transaction",
             foreign_key: "subcategory_id",
             dependent: :restrict_with_error

    enum :category_type, { income: "income", expense: "expense" }

    validates :name, presence: true
    validates :name,
              uniqueness: {
                scope: %i[space_id category_type],
                conditions: -> { where(parent_id: nil) },
                message: "already exists for this space and type"
              },
              if: -> { parent_id.nil? }
    validates :name,
              uniqueness: {
                scope: %i[space_id category_type parent_id],
                message: "already exists under this parent category"
              },
              if: -> { parent_id.present? }
    validate :parent_must_be_root
    validate :parent_matches_space_and_type

    scope :roots, -> { where(parent_id: nil) }
    scope :subcategories, -> { where.not(parent_id: nil) }
    scope :income, -> { where(category_type: :income).where.not(name: UNINCLUDED_INCOME_CATEGORIES) }
    scope :expense, -> { where(category_type: :expense).where.not(name: UNINCLUDED_EXPENSE_CATEGORIES) }

    def root?
      parent_id.nil?
    end

    def subcategory?
      parent_id.present?
    end

    def self.transfer_fee
      find_by(name: "Transfer Fee")
    end

    def self.create_default_categories(space)
      transaction do
        (DEFAULT_INCOME_CATEGORIES + ["Initial Balance", "Income Adjustment"]).each do |name|
          find_or_create_by(name:, category_type: "income", space:, parent_id: nil)
        end

        (DEFAULT_EXPENSE_CATEGORIES + ["Transfer Fee", "Expense Adjustment"]).each do |name|
          find_or_create_by(name:, category_type: "expense", space:, parent_id: nil)
        end
      end
    end

    private

    def parent_must_be_root
      return if parent_id.blank?

      parent_record = parent
      return if parent_record.blank?

      return if parent_record.parent_id.nil?

      errors.add(:parent_id, "cannot be nested more than one level deep")
    end

    def parent_matches_space_and_type
      return if parent_id.blank?

      parent_record = parent
      return if parent_record.blank?

      if parent_record.space_id != space_id
        errors.add(:parent_id, "must belong to the same space")
      end

      return if parent_record.category_type == category_type

      errors.add(:parent_id, "must have the same category type")
    end
  end
end
