# frozen_string_literal: true

FactoryBot.define do
  factory :budget do
    association :space
    category { association :category, space: space, category_type: :expense }

    amount { 1000 }
    spent { 0 }
    date { Time.zone.today }
  end
end
