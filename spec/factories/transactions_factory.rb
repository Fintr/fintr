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
    schedule_type { "one_time" }
    type { "Transactions::Income" }

    factory :income_transaction, class: "Transactions::Income" do
      type { "Transactions::Income" }

      trait :one_time do
        schedule_type { "one_time" }
      end

      trait :repeat do
        schedule_type { "repeat" }
        repeat_interval { "every_month" }
        repeat_count { 3 }
      end
    end

    factory :expense_transaction, class: "Transactions::Expense" do
      type { "Transactions::Expense" }

      trait :one_time do
        schedule_type { "one_time" }
      end

      trait :repeat do
        schedule_type { "repeat" }
        repeat_interval { "every_month" }
        repeat_count { 3 }
      end

      trait :installment do
        schedule_type { "installment" }
        installment_period { "every_month" }
        installment_count { 6 }
      end
    end
  end
end
