# frozen_string_literal: true

FactoryBot.define do
  factory :account, class: "Transactions::Account" do
    sequence(:name) { |n| "Test Account #{n}" }
    association :space
    balance_cents { 10000 }
    balance_currency { "PHP" }
    account_category { "cash" }
  end
end
