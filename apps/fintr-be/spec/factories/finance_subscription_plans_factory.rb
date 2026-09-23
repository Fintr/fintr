# frozen_string_literal: true

FactoryBot.define do
  factory :subscription_plan, class: "Finance::SubscriptionPlan" do
    name { "Pro" }
    sequence(:slug) { |n| "pro-#{n}" }
    price_cents { 29_900 }
    price_currency { "PHP" }
    interval { "month" }
    active { true }
    description { "Fintr Pro" }

    trait :standard do
      name { "Standard" }
      slug { "standard" }
      price_cents { 25_000 }
      description { "Legacy standard plan" }
    end

    trait :premium do
      name { "Premium" }
      slug { "premium" }
      price_cents { 39_900 }
      description { "Legacy premium plan" }
    end

    trait :free do
      name { "Free" }
      slug { "free" }
      price_cents { 0 }
      description { "Legacy free plan" }
    end
  end
end
