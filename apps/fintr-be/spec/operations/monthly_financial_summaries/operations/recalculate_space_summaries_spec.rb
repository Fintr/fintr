# frozen_string_literal: true

require "rails_helper"

RSpec.describe MonthlyFinancialSummaries::Operations::RecalculateSpaceSummaries, type: :operation do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user], currency: "GBP") }

  describe "#call" do
    subject(:result) { operation.call(space_id: space.id) }

    let!(:expense) do
      create(
        :expense_transaction,
        space:,
        user:,
        account: create(:account, space:),
        category: create(:category, space:, category_type: "expense"),
        date: Date.new(2024, 4, 10),
        amount_cents: 100_000,
        balance_state: :calculated
      )
    end

    before do
      ExchangeRates::ApiExchangeRate.create!(
        base_currency: "USD",
        target_currency: "PHP",
        rate: 58.0,
        rate_date: Date.new(2024, 4, 10)
      )
      ExchangeRates::ApiExchangeRate.create!(
        base_currency: "USD",
        target_currency: "GBP",
        rate: 0.79,
        rate_date: Date.new(2024, 4, 10)
      )
    end

    it { is_expected.to be_success }

    it "recalculates summaries in the space currency" do
      stale_summary = create(
        :monthly_financial_summary,
        space:,
        year: 2024,
        month: 4,
        currency: "PHP",
        fx_based: false,
        total_income: 999,
        total_expenses: 999,
        net_savings: 0
      )

      value = result.value!
      stale_summary.reload

      expect(value[:currency]).to eq("GBP")
      expect(stale_summary.currency).to eq("GBP")
      expect(stale_summary.fx_based).to be(true)
      expect(stale_summary.total_expenses).not_to eq(999)
    end
  end
end
