# frozen_string_literal: true

FactoryBot.define do
  factory :transfer, class: 'Transactions::Transfer' do
    association :space
    association :user
    association :from_account, factory: :account
    association :to_account, factory: :account

    amount { 100 }
    amount_currency { 'PHP' }
    transaction_cost { 0 }
    transaction_cost_currency { 'PHP' }
    date { Date.today }
    schedule_type { "one_time" }
    description { "Transfer" }
    balance_state { "calculated" }
    schedule { {} }

    trait :repeat do
      schedule_type { "repeat" }
      repeat_interval { "every_month" }
      repeat_count { 3 }
    end

    trait :with_transaction_cost do
      transaction_cost { 5 }
    end
  end
end
