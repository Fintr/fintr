# frozen_string_literal: true

class Transaction < ApplicationRecord
  belongs_to :user

  enum :transaction_type, {
    income: "income",
    expense: "expense"
  }

  enum :expense_category, {
    house: "house",
    food: "food",
    transportation: "transportation",
    utilities: "utilities",
    insurance: "insurance",
    family: "family",
    pet: "pet",
    socials: "socials",
    entertainment: "entertainment",
    travel: "travel",
    business: "business"
  }, suffix: :expense

  enum :income_category, {
    salary: "salary",
    freelance: "freelance",
    business: "business"
  }, suffix: :income

  enum :essentialness, {
    want: "want",
    need: "need"
  }

  # Define which expense categories are needs and wants
  NEED_CATEGORIES = %w[house food transportation utilities insurance family pet]
  WANT_CATEGORIES = %w[socials entertainment travel business]

  # Required field validations
  validates :date, presence: true
  validates :amount, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :balance, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :transaction_type, presence: true

  # Validate expense and income categories based on transaction type
  validates :expense_category, presence: true, if: -> { expense? }
  validates :income_category, presence: true, if: -> { income? }

  # Set the essentialness based on expense category
  before_validation :set_essentialness, if: -> { expense? && expense_category.present? }

  # Clear the inappropriate category field when transaction type changes
  before_save :clear_inappropriate_category

  private

  def clear_inappropriate_category
    self.expense_category = nil if income? && expense_category.present?
    self.income_category = nil if expense? && income_category.present?
  end

  def set_essentialness
    if NEED_CATEGORIES.include?(expense_category)
      self.essentialness = "need"
    elsif WANT_CATEGORIES.include?(expense_category)
      self.essentialness = "want"
    end
  end
end
