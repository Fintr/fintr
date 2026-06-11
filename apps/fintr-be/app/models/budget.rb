# frozen_string_literal: true

class Budget < ApplicationRecord
  include CategoryAssignable

  belongs_to :space, class_name: "Spaces::Space"

  monetize :amount_cents, allow_nil: false
  monetize :spent_cents, allow_nil: false

  validates :date, presence: true
  validate :category_is_expense
  validate :only_one_budget_for_month

  delegate :month, :year, to: :date

  scope :for_month, ->(reference_date, time_zone = "Asia/Manila") do
    where(date: reference_date.in_time_zone(time_zone).all_month)
  end

  scope :parent_budgets, -> { where(subcategory_id: nil) }
  scope :subcategory_budgets, -> { where.not(subcategory_id: nil) }

  def parent_budget?
    subcategory_id.nil?
  end

  def transactions
    scope = Transactions::Transaction.where(space:, date: date.all_month, category_id:)

    if parent_budget?
      scope
    else
      scope.where(subcategory_id:)
    end
  end

  private

  def category_is_expense
    return if category.expense?

    errors.add(:category, "must be an expense category")
  end

  def only_one_budget_for_month
    existing = Budget.where(space:, category_id:)
                     .where(subcategory_id:)
                     .for_month(date)
                     .where.not(id:)

    return if existing.empty?

    errors.add(:base, "A budget already exists for this category in the selected month")
  end
end
