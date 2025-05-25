# frozen_string_literal: true

module Transactions
  class MonthlyTotal < ApplicationRecord
    self.table_name = "transactions_monthly_totals"

    belongs_to :space, class_name: "Spaces::Space"

    validates :date, presence: true
    validate :only_one_monthly_total_per_month

    monetize :income_cents, allow_nil: false
    monetize :expense_cents, allow_nil: false

    def net_total
      income - expense
    end

    private

    def only_one_monthly_total_per_month
      return unless date.present?

      for_space_date_month_exists = self.class.where(space:)
                                      .where(date: date.all_month)
                                      .where.not(id: id)
                                      .exists?
      return unless for_space_date_month_exists

      errors.add(:base, "Only one monthly total per month")
    end
  end
end
