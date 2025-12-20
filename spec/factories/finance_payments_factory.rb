# frozen_string_literal: true

FactoryBot.define do
  factory :finance_payment, class: "Finance::Payment" do
    association :space_subscription, factory: :space_subscription
    xendit_cycle_id { "cycle-#{SecureRandom.uuid}" }
    xendit_reference_id { "ref-#{SecureRandom.uuid}" }
    amount_cents { 14_900 }
    amount_currency { "PHP" }
    status { "pending" }
    payment_method_type { "CREDIT_CARD" }
    payment_method_id { "pm-#{SecureRandom.uuid}" }
    xendit_data { {} }
    metadata { {} }

    trait :succeeded do
      status { "succeeded" }
      paid_at { Time.current }
    end

    trait :failed do
      status { "failed" }
      failed_at { Time.current }
      failure_reason { "Insufficient funds" }
    end

    trait :refunded do
      status { "refunded" }
      paid_at { 1.day.ago }
    end
  end
end
