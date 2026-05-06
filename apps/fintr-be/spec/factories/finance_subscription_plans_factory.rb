# frozen_string_literal: true

FactoryBot.define do
  factory :subscription_plan, class: "Finance::SubscriptionPlan" do
    name { "Basic" }
    slug { "basic" }
    token_limit { 50 }
    price_cents { 14_900 }
    price_currency { "PHP" }
    interval { "month" }
    active { true }
    description { "Basic plan with 50 credits per month" }

    trait :standard do
      name { "Standard" }
      slug { "standard" }
      token_limit { 100 }
      price_cents { 25_000 }
      description { "Standard plan with 100 credits per month" }
    end

    trait :premium do
      name { "Premium" }
      slug { "premium" }
      token_limit { 250 }
      price_cents { 39_900 }
      description { "Premium plan with 250 credits per month" }
    end

    trait :free do
      name { "Free" }
      slug { "free" }
      token_limit { 30 }
      price_cents { 0 }
      description { "Free plan with 30 credits per month" }
    end
  end
end
