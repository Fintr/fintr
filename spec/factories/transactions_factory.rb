# frozen_string_literal: true

FactoryBot.define do
  factory :transaction, class: "Transactions::Transaction" do
    association :user
    association :space
    association :account
    association :category
    date { Time.zone.now }
    amount { 100.00 }
    amount_currency { 'PHP' }
    balance { 100.00 }
    balance_currency { 'PHP' }
    sequence(:description) { |n| "Test transaction #{n}" }
    type { "Transactions::Income" }

    factory :income_transaction, class: "Transactions::Income" do
      type { "Transactions::Income" }
    end

    factory :expense_transaction, class: "Transactions::Expense" do
      type { "Transactions::Expense" }
      expense_type { "one_time" }

      trait :one_time do
        expense_type { "one_time" }
      end

      trait :repeat do
        expense_type { "repeat" }
        repeat_interval { "monthly" }
        repeat_count { 3 }
      end

      trait :installment do
        expense_type { "installment" }
        installment_period { "monthly" }
        installment_count { 6 }
      end
    end
  end
end
