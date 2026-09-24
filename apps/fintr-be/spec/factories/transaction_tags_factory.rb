# frozen_string_literal: true

FactoryBot.define do
  factory :transaction_tag, class: "Transactions::Tag" do
    space { association(:personal_space) }
    sequence(:name) { |n| "Tag #{n}" }
    color { "#0A3D62" }
  end
end
