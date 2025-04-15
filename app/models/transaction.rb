# frozen_string_literal: true

class Transaction < ApplicationRecord
  belongs_to :user

  monetize :amount_cents, allow_nil: false
  monetize :balance_cents, allow_nil: false

  # Required field validations
  validates :date, presence: true
  validates :amount_cents, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :balance_cents, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :type, presence: true

  def value
    amount
  end
end
