# frozen_string_literal: true

FactoryBot.define do
  factory :transaction, class: "Transactions::Transaction" do
    association :user
    date { Time.zone.now }
    amount { 100.00 }
    balance { 100.00 }
    sequence(:description) { |n| "Test transaction #{n}" }
    type { "Transactions::Income" }

    factory :income_transaction, class: "Transactions::Income" do
      type { "Transactions::Income" }
    end

    factory :expense_transaction, class: "Transactions::Expense" do
      type { "Transactions::Expense" }
    end
  end
end
