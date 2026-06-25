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

  validates :currency,
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

  scope :in_date_range,
        ->(start_date:, end_date:) {
          start_y, start_m = start_date.year, start_date.month
          end_y, end_m = end_date.year, end_date.month
          where(
            " (year > ? OR (year = ? AND month >= ?)) AND (year < ? OR (year = ? AND month <= ?)) ",
            start_y, start_y, start_m,
            end_y, end_y, end_m
          ).order(:year, :month)
        }

  def self.find_or_create_for_space_and_month(space:, year: Date.current.year, month: Date.current.month)
    recalculate_for_space_and_month!(
      space:,
      year:,
      month:
    )
  end

  def self.find_or_create_record_for_space_and_month(space:, year:, month:)
    find_by(space:, year:, month:) ||
      create_record_for_space_and_month(
        space:,
        year:,
        month:
      )
  end

  def self.recalculate_for_space_and_month!(space:, year:, month:)
    summary = find_or_create_record_for_space_and_month(
      space:,
      year:,
      month:
    )
    summary.recalculate!
    summary
  end

  def self.apply_totals_for_space_and_month!(space:, year:, month:, totals:)
    summary = find_by(space:, year:, month:)

    if summary.nil?
      return nil if totals_empty?(totals)

      summary = create_record_for_space_and_month(
        space:,
        year:,
        month:
      )
    end

    summary.apply_totals!(totals:)
    summary
  end

  def self.totals_empty?(totals)
    totals[:total_income].to_d.zero? &&
      totals[:total_expenses].to_d.zero?
  end

  def self.create_record_for_space_and_month(space:, year:, month:)
    create!(
      space:,
      year:,
      month:,
      calculated_at: Time.current,
      currency: space.currency.presence || "PHP",
      total_income: 0,
      total_expenses: 0,
      net_savings: 0
    )
  rescue ActiveRecord::RecordNotUnique
    find_by!(space:, year:, month:)
  end

  def fresh?
    fx_based? && currency == space_currency_code
  end

  def recalculate!
    with_lock do
      start_date = Date.new(year, month, 1)
      end_date = start_date.end_of_month
      totals = MonthlyFinancialSummaries::Queries::AggregateTotalsInSpaceForRange.call(
        space:,
        start_date:,
        end_date:
      )

      update!(
        total_income: totals[:total_income],
        total_expenses: totals[:total_expenses],
        net_savings: totals[:net_savings],
        currency: space_currency_code,
        fx_based: true,
        calculated_at: Time.current
      )
    end
  end

  def apply_totals!(totals:)
    with_lock do
      update!(
        total_income: totals[:total_income],
        total_expenses: totals[:total_expenses],
        net_savings: totals[:net_savings],
        currency: space_currency_code,
        fx_based: true,
        calculated_at: Time.current
      )
    end
  end

  def savings_percentage
    return 0 if total_income.zero?

    (net_savings / total_income * 100).round(2)
  end

  private

  def space_currency_code
    space.currency.presence || "PHP"
  end
end
