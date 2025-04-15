# frozen_string_literal: true

FactoryBot.define do
  factory :transaction do
    association :user
    date { Time.zone.now }
    amount { 100.00 }
    balance { 100.00 }
    sequence(:description) { |n| "Test transaction #{n}" }
    type { "Income" }
  end
end
