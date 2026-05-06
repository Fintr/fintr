# frozen_string_literal: true

FactoryBot.define do
  factory :category, class: "Transactions::Category" do
    association :space
    name { "Category" }
    category_type { "income" }
  end
end
