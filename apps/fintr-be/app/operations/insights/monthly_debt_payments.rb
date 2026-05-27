# frozen_string_literal: true

module Insights
  module MonthlyDebtPayments
    module_function

    def total_for_space(space:)
      Transactions::Loan
        .where(space_id: space.id, loan_type: :borrowed, status: :active)
        .sum { |loan| estimate_monthly_payment(loan).to_d }
    end

    def estimate_monthly_payment(loan)
      principal_amount = loan.outstanding_balance.amount.to_f
      term_months = loan.loan_term_months
      return 0.0 if principal_amount <= 0 || term_months.nil? || term_months <= 0

      monthly_rate = loan.interest_rate.to_f / 100.0 / 12.0

      if monthly_rate.zero?
        principal_amount / term_months
      else
        one_plus_rate = 1 + monthly_rate
        power_result = one_plus_rate**term_months
        denominator = power_result - 1
        return 0.0 if denominator <= 0

        principal_amount * ((monthly_rate * power_result) / denominator)
      end
    end
  end
end
