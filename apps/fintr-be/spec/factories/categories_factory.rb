# frozen_string_literal: true

FactoryBot.define do
  factory :category, class: "Transactions::Category" do
    association :space
    sequence(:name) { |n| "Category #{n}" }
    category_type { "income" }
  end
end
