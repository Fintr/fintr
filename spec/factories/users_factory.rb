# frozen_string_literal: true

FactoryBot.define do
  factory :user, class: "Auth::User" do
    auth_id { SecureRandom.uuid }
    sequence(:email) { |n| "user#{n}@example.com" }
  end
end
