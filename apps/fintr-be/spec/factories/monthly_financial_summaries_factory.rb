# frozen_string_literal: true

FactoryBot.define do
  factory :monthly_financial_summary, class: "MonthlyFinancialSummary" do
    association :space, factory: :space
    year { Date.current.year }
    month { Date.current.month }
    total_income { 5000.00 }
    total_expenses { 3000.00 }
    net_savings { 2000.00 }
    calculated_at { Time.current }
    currency { space.currency.presence || "PHP" }
    fx_based { true }

    trait :current_month do
      year { Date.current.year }
      month { Date.current.month }
    end

    trait :previous_month do
      year { 1.month.ago.year }
      month { 1.month.ago.month }
    end

    trait :with_zero_income do
      total_income { 0.00 }
      net_savings { -total_expenses }
    end

    trait :with_zero_expenses do
      total_expenses { 0.00 }
      net_savings { total_income }
    end
  end
end
