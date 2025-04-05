class Transaction < ApplicationRecord
  belongs_to :user

  enum :transaction_type, {
    income: "income",
    expense: "expense"
  }

  enum :expense_category, {
    food: "food",
    transportation: "transportation",
    utilities: "utilities",
    entertainment: "entertainment",
    shopping: "shopping",
    house: "house"
  }

  enum :income_category, {
    salary: "salary",
    freelance: "freelance",
    business: "business"
  }

  # Required field validations
  validates :date, presence: true
  validates :amount, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :balance, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :transaction_type, presence: true

  # Validate that the appropriate category is set based on transaction_type
  validates :expense_category, presence: true, if: -> { expense? }
  validates :income_category, presence: true, if: -> { income? }

  # Clear the inappropriate category field when transaction type changes
  before_save :clear_inappropriate_category

  private

  def clear_inappropriate_category
    self.expense_category = nil if income? && expense_category.present?
    self.income_category = nil if expense? && income_category.present?
  end
end
