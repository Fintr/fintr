# frozen_string_literal: true

FactoryBot.define do
  factory :onboarding do
    association :user
    step { "income" }
    data { { "budgets" => [], "income" => {} } }
  end
end
