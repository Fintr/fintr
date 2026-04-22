# frozen_string_literal: true

FactoryBot.define do
  factory :space_subscription, class: "Finance::SpaceSubscription" do
    association :space, factory: :space
    association :subscription_plan, factory: :subscription_plan
    xendit_plan_id { "plan-#{SecureRandom.uuid}" }
    xendit_customer_id { "cust-#{SecureRandom.uuid}" }
    xendit_schedule_id { "schedule-#{SecureRandom.uuid}" }
    status { "pending" }
    subscription_type { "paid" }
    started_at { Time.current }
    current_cycle_count { 0 }
    total_cycles { 12 }
    metadata { {} }

    trait :active do
      status { "active" }
      started_at { 1.month.ago }
    end

    trait :inactive do
      status { "inactive" }
      started_at { 1.year.ago }
      ended_at { Time.current }
    end

    trait :requires_action do
      status { "requires_action" }
    end

    trait :sponsor do
      subscription_type { "sponsor" }
      xendit_plan_id { nil }
      xendit_customer_id { nil }
      xendit_schedule_id { nil }
    end

    trait :free do
      subscription_type { "free" }
      xendit_plan_id { nil }
      xendit_customer_id { nil }
      xendit_schedule_id { nil }
    end
  end
end
