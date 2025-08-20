# frozen_string_literal: true

class Budget < ApplicationRecord
  belongs_to :space, class_name: "Spaces::Space"
  belongs_to :category, class_name: "Transactions::Category"

  monetize :amount_cents, allow_nil: false
  monetize :spent_cents, allow_nil: false

  validates :date, presence: true
  validate :category_is_expense
  validate :only_one_category_for_month

  delegate :month, :year, to: :date

  scope :for_month, ->(reference_date) { where(date: reference_date.all_month) }

  def transactions
    category.transactions.where(space:, date: date.all_month)
  end

  private

  def category_is_expense
    return if category.expense?

    errors.add(:category, "must be an expense category")
  end

  def only_one_category_for_month
    return if Budget.where(space:, category:)
                    .for_month(date)
                    .where.not(id:)
                    .empty?

    errors.add(:category, "must be the only expense category for the month")
  end
end
