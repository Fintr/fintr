# frozen_string_literal: true

class MonthlyFinancialSummary < ApplicationRecord
  belongs_to :space, class_name: "Spaces::Space"

  validates :year,
            presence: true,
            numericality: { greater_than: 2000, less_than: 2100 }

  validates :month,
            presence: true,
            numericality: { greater_than: 0, less_than: 13 }

  validates :total_income,
            presence: true,
            numericality: { greater_than_or_equal_to: 0 }

  validates :total_expenses,
            presence: true,
            numericality: { greater_than_or_equal_to: 0 }

  validates :net_savings,
            presence: true

  validates :calculated_at,
            presence: true

  validates :space_id,
            uniqueness: { scope: [:year, :month] }

  scope :for_space,
        ->(space) { where(space:) }

  scope :for_month,
        ->(year, month) { where(year:, month:) }

  scope :current_month,
        -> { for_month(Date.current.year, Date.current.month) }

  scope :recent,
        -> { order(year: :desc, month: :desc) }

  def self.find_or_create_for_space_and_month(space:, year: Date.current.year, month: Date.current.month)
    summary = find_or_create_by(
      space:,
      year:,
      month:
    ) do |summary|
      summary.calculated_at = Time.current
    end
    summary.recalculate! if !summary.persisted?
    summary
  end

  def recalculate!
    update!(
      total_income: calculate_total_income,
      total_expenses: calculate_total_expenses,
      net_savings: calculate_net_savings,
      calculated_at: Time.current
    )
  end

  def savings_percentage
    return 0 if total_income.zero?

    (net_savings / total_income * 100).round(2)
  end

  private

  def calculate_total_income
    Transactions::Queries::FilteredTransactions.call(params: {
      space_code: space.code,
      start_date: Date.new(year, month, 1),
      end_date: Date.new(year, month, 1).end_of_month,
      balance_state: "calculated",
      transaction_type: "Transactions::Income",
      paginate: false,
      without_initial_balance: true
    })
    .value!
    .sum(:amount_cents) / 100.0
  end

  def calculate_total_expenses
    Transactions::Queries::FilteredTransactions.call(params: {
      space_code: space.code,
      start_date: Date.new(year, month, 1),
      end_date: Date.new(year, month, 1).end_of_month,
      balance_state: "calculated",
      transaction_type: "Transactions::Expense",
      paginate: false,
      without_initial_balance: true
    })
    .value!
    .sum(:amount_cents) / 100.0
  end

  def calculate_net_savings
    calculate_total_income - calculate_total_expenses
  end
end
