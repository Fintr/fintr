# frozen_string_literal: true

FactoryBot.define do
  factory :loan, class: "Transactions::Loan" do
    association :user
    association :space
    association :entity
    association :account
    principal_amount_cents { 100_000_00 } # 100,000 PHP
    outstanding_balance_cents { 100_000_00 }
    interest_rate { 10.0 }
    loan_term_months { 12 }
    date { Date.current }
    maturity_date { Date.current + 12.months }
    loan_type { "borrowed" }
    status { "active" }
    currency { "PHP" }
  end
end

