# frozen_string_literal: true

class Onboarding < ApplicationRecord
  belongs_to :user, class_name: "Auth::User"

  enum :step, {
    income: "income",
    budgets: "budgets",
    accounts: "accounts",
    completed: "completed"
  }

  validates :step, presence: true
end
