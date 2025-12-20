# frozen_string_literal: true

FactoryBot.define do
  factory :finance_billing_cycle, class: "Finance::BillingCycle" do
    association :space_subscription, factory: :space_subscription
    cycle_number { 1 }
    xendit_cycle_id { "cycle-#{SecureRandom.uuid}" }
    tokens_allocated { 100 }
    status { "pending" }
    metadata { {} }

    # Default span: current month
    span do
      start_time = Time.zone.now.beginning_of_month
      end_time = Time.zone.now.end_of_month
      (start_time..end_time)
    end

    trait :paid do
      status { "paid" }
      paid_at { Time.zone.now }
    end

    trait :failed do
      status { "failed" }
    end

    trait :for_month do
      transient do
        month { Time.zone.now.month }
        year { Time.zone.now.year }
      end

      span do
        start_time = Time.zone.parse("#{year}-#{month.to_s.rjust(2, '0')}-01").beginning_of_day
        end_time = start_time.end_of_month.end_of_day
        (start_time..end_time)
      end
    end

    trait :expired do
      span do
        start_time = 2.months.ago.beginning_of_month
        end_time = 2.months.ago.end_of_month.end_of_day
        (start_time..end_time)
      end
    end

    trait :future do
      span do
        start_time = 1.month.from_now.beginning_of_month
        end_time = 1.month.from_now.end_of_month.end_of_day
        (start_time..end_time)
      end
    end
  end
end
