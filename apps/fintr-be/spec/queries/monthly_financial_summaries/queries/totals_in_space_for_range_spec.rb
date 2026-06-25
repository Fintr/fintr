# frozen_string_literal: true

require "rails_helper"

RSpec.describe MonthlyFinancialSummaries::Queries::TotalsInSpaceForRange do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user], currency: "PHP") }
  let(:account) { create(:account, space:) }
  let(:category) { create(:category, space:, category_type: "expense") }

  describe ".call" do
    subject(:result) do
      described_class.call(
        space:,
        start_date:,
        end_date:
      )
    end

    context "when the requested range starts before the earliest transaction month" do
      let(:start_date) { Date.new(2000, 1, 1) }
      let(:end_date) { Date.new(2024, 6, 30) }

      before do
        create(
          :expense_transaction,
          space:,
          user:,
          account:,
          category:,
          date: Date.new(2024, 4, 10),
          amount_cents: 100_00,
          balance_state: :calculated
        )
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: "USD",
          target_currency: "PHP",
          rate: 58.0,
          rate_date: Date.new(2024, 4, 10)
        )
      end

      it "does not create monthly summaries for empty pre-transaction months" do
        expect { result.value! }.to change(MonthlyFinancialSummary, :count).by(1)

        expect(
          MonthlyFinancialSummary.where(space:, year: 2000, month: 1)
        ).not_to exist
      end

      it "returns totals only from months with transaction activity" do
        expect(result.value![:total_expenses]).to be > 0
      end
    end

    context "when the space has no transactions" do
      let(:start_date) { Date.new(2000, 1, 1) }
      let(:end_date) { Date.current }

      it "returns zero totals without creating summaries" do
        expect { result.value! }.not_to change(MonthlyFinancialSummary, :count)
        expect(result.value!).to eq(
          {
            total_income: 0.to_d,
            total_expenses: 0.to_d,
            net_savings: 0.to_d
          }
        )
      end
    end
  end
end
