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
    balance_state { "calculated" }
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
        installment_period { 12 }
        installment_count { 6 }
      end
    end

    factory :draft_transaction, class: "Transactions::Draft" do
      type { "Transactions::Draft" }
    end
  end

  factory :combined_transaction, class: "Transactions::Combined" do
    association :space
    # Commenting out associations that might cause issues if foreign keys aren't in the view
    # or if they cause issues with build_stubbed for a read-only model.
    # association :category, factory: :category
    # association :from_account, factory: :account
    # association :to_account, factory: :account

    # You might need to manually set the foreign key attributes if they exist in the view
    # and are needed for other tests, e.g.:
    # category_id { create(:category, space: space).id }

    transactable { build_stubbed(:expense_transaction, space: space) } # Example transactable

    date { Time.zone.now }
    amount_cents { 10000 }
    amount_currency { "PHP" }
    balance_cents { 50000 }
    balance_currency { "PHP" }

    # Add other attributes from the combined_transactions view as needed
    # For example:
    # description { transactable.description }
    # type { transactable.type }
    # category_name { category&.name }
    # from_account_name { from_account&.name }
    # to_account_name { to_account&.name }
  end
end
