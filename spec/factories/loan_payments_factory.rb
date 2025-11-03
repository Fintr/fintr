# frozen_string_literal: true

FactoryBot.define do
  factory :loan_payment, class: "Transactions::LoanPayment" do
    association :loan
    association :account
    date { Date.current }
    principal_payment_cents { 7_942_27 } # 7,942.27 PHP
    interest_payment_cents { 849_32 } # 849.32 PHP
    total_payment_cents { 8_791_59 } # 8,791.59 PHP
    currency { "PHP" }
  end
end

