# frozen_string_literal: true

module CategoryAssignable
  extend ActiveSupport::Concern

  included do
    belongs_to :subcategory,
               class_name: "Transactions::Category",
               optional: true

    validate :category_assignment_consistency
  end

  private

  def category_assignment_consistency
    parent = category
    return errors.add(:category_id, "is invalid") if parent.blank?

    unless parent.root?
      errors.add(:category_id, "must be a parent category")
    end

    return if subcategory_id.blank?

    sub = subcategory
    return errors.add(:subcategory_id, "is invalid") if sub.blank?

    if category_id != sub.parent_id
      errors.add(:subcategory_id, "must belong to the selected parent category")
    end

    return if sub.parent_id.present?

    errors.add(:subcategory_id, "must be a subcategory, not a parent")
  end
end
