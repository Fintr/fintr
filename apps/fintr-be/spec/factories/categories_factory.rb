# frozen_string_literal: true

FactoryBot.define do
  factory :category, class: "Transactions::Category" do
    association :space
    sequence(:name) { |n| "Category #{n}" }
    category_type { "income" }
    parent_id { nil }

    trait :expense do
      category_type { "expense" }
    end

    trait :subcategory do
      association :parent, factory: %i[category expense], strategy: :create
      category_type { "expense" }
      space { parent.space }
      sequence(:name) { |n| "Subcategory #{n}" }
    end
  end
end
