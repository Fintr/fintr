# frozen_string_literal: true

FactoryBot.define do
  factory :transaction do
    association :user
    date { Time.zone.now }
    amount { 100.00 }
    balance { 100.00 }
    sequence(:description) { |n| "Test transaction #{n}" }
    essentialness { 'want' }

    # To handle NOT NULL constraints, we need to provide both categories by default
    transaction_type { 'expense' }
    expense_category { 'food' }
    income_category { 'salary' } # Default value to satisfy NOT NULL constraint

    trait :expense do
      transaction_type { 'expense' }
      expense_category { 'food' }
      income_category { 'salary' } # Keep a value to satisfy NOT NULL constraint
      essentialness { 'need' }
    end

    trait :income do
      transaction_type { 'income' }
      income_category { 'salary' }
      expense_category { 'food' } # Keep a value to satisfy NOT NULL constraint
    end

    # Need category traits
    Transaction::NEED_CATEGORIES.each do |category|
      trait category.to_sym do
        transaction_type { 'expense' }
        expense_category { category }
        essentialness { 'need' }
      end
    end

    # Want category traits
    Transaction::WANT_CATEGORIES.each do |category|
      trait category.to_sym do
        transaction_type { 'expense' }
        expense_category { category }
        essentialness { 'want' }
      end
    end

    # Income category traits
    trait :salary do
      transaction_type { 'income' }
      income_category { 'salary' }
    end

    trait :freelance do
      transaction_type { 'income' }
      income_category { 'freelance' }
    end

    trait :business_income do
      transaction_type { 'income' }
      income_category { 'business' }
    end
  end
end
