# frozen_string_literal: true

module Repeatable
  extend ActiveSupport::Concern

  included do
    enum :schedule_type, {
      one_time: "one_time",
      repeat: "repeat",
      installment: "installment"
    }

    enum :repeat_interval, {
      every_day: "every_day",
      every_week: "every_week",
      every_2_weeks: "every_2_weeks",
      every_month: "every_month",
      every_2_months: "every_2_months",
      every_3_months: "every_3_months",
      every_6_months: "every_6_months",
      every_year: "every_year"
    }

    validates :schedule_type,
              presence: true,
              inclusion: { in: schedule_types.values }
    validates :repeat_interval, presence: true, if: -> { repeat? }
    validates :repeat_count, presence: true, if: -> { repeat? }
  end

  # Returns the record that should be used as template for future transactions/transfers
  def template_for_future_transactions
    effective_parent || self
  end

  # Returns the root parent of the recurring series (the original parent)
  # This is used to find all records in the same series, as they all share the same parent_id
  def root_parent
    return self if parent_id.nil?

    # Find the record that has no parent (the root)
    current = self
    while current.parent_id.present?
      current = current.parent
    end
    current
  end

  # Determines if this record is part of a series (not the only one) without database queries
  # A record is in a series if:
  # 1. It has a parent (it's a child in a recurring series), OR
  # 2. It has loaded children, OR
  # 3. It's a repeat/installment type (indicating it should have generated children)
  def in_series?
    # Has a parent - definitely part of a series
    return true if parent_id.present?

    # Check if children association is loaded and has records
    return true if children.loaded? && children.any?

    # For recurring records without loaded children, check schedule type
    # If it's repeat or installment, it likely has/will have children
    repeat? || (respond_to?(:installment?) && installment?)
  end

  # Returns all records in the same recurring series (including self)
  # Uses self.class to work generically with any model that includes this concern
  def series_records
    root = root_parent
    self.class.where("(parent_id = :root_id OR id = :root_id)", root_id: root.id)
  end

  # Convenience aliases for model-specific naming conventions
  def series_transactions
    series_records
  end

  def series_transfers
    series_records
  end
end
