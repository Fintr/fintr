# frozen_string_literal: true

FactoryBot.define do
  factory :space_user do
    association :user
    association :space
  end
end
