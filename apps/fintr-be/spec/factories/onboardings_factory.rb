# frozen_string_literal: true

FactoryBot.define do
  factory :onboarding do
    association :user
    step { "currency" }  # Matches database default
    data { {} }
  end
end
