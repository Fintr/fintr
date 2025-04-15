# frozen_string_literal: true

FactoryBot.define do
  factory :user do
    auth_id { SecureRandom.uuid }
    sequence(:email) { |n| "user#{n}@example.com" }
  end
end
