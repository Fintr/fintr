# frozen_string_literal: true

require "rails_helper"

RSpec.describe MonthlyFinancialSummaries::Queries::TotalsForMonth do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user], currency: "PHP") }
  let(:account) { create(:account, space:) }
  let(:expense_category) { create(:category, space:, category_type: "expense") }

  describe ".call" do
    it "recalculates when a fresh bucket still has zero totals" do
      month_start = Date.new(2026, 7, 1)
      summary = create(
        :monthly_financial_summary,
        space:,
        year: 2026,
        month: 7,
        total_income: 0,
        total_expenses: 0,
        net_savings: 0,
        fx_based: true,
        currency: "PHP",
      )

      create(
        :expense_transaction,
        space:,
        user:,
        account:,
        category: expense_category,
        date: Date.new(2026, 7, 15),
        amount_cents: 25_000,
        balance_state: :calculated,
      )

      totals = described_class.call(
        space:,
        month_start:,
        persist_stale: true,
      )

      expect(totals[:total_expenses].to_d).to be > 0
      expect(summary.reload.total_expenses.to_d).to be > 0
    end
  end
end
