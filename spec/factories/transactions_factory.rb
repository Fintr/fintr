FactoryBot.define do
  factory :transaction do
    association :user
    date { Time.zone.now }
    amount { 100.00 }
    balance { 100.00 }
    sequence(:description) { |n| "Test transaction #{n}" }

    # Notice that the migration has removed the NOT NULL constraint from expense_category and income_category
    # This allows our callback to work properly by clearing the inappropriate category
    transaction_type { 'expense' }
    expense_category { 'food' }
    
    # For traits representing expense transactions, income_category can be nil
    trait :expense do
      transaction_type { 'expense' }
      expense_category { 'food' }
      income_category { nil }
    end

    # For traits representing income transactions, expense_category can be nil
    trait :income do
      transaction_type { 'income' }
      income_category { 'salary' }
      expense_category { nil }
    end
  end
end
