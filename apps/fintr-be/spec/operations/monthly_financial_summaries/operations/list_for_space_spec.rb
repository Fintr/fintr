# frozen_string_literal: true

require "rails_helper"

RSpec.describe MonthlyFinancialSummaries::Operations::ListForSpace, type: :operation do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user], currency: "PHP") }
  let(:account) { create(:account, space:) }
  let(:expense_category) { create(:category, space:, category_type: "expense") }

  describe "#call" do
    subject(:result) { operation.call(params) }

    let(:params) { { space_id: space.id } }

    context "when the space does not exist" do
      let(:params) { { space_id: SecureRandom.uuid } }

      it { is_expected.to be_failure }

      it "returns a space_id error" do
        expect(result.failure).to eq(space_id: "not found")
      end
    end

    context "when the space has no transactions" do
      it { is_expected.to be_success }

      it "returns an empty list" do
        expect(result.value!).to eq([])
      end
    end

    context "when the space has transactions across months" do
      before do
        create(
          :expense_transaction,
          space:,
          user:,
          account:,
          category: expense_category,
          date: Date.new(2026, 6, 15),
          amount_cents: 10_000,
          balance_state: :calculated
        )
        create(
          :expense_transaction,
          space:,
          user:,
          account:,
          category: expense_category,
          date: Date.new(2026, 7, 20),
          amount_cents: 20_000,
          balance_state: :calculated
        )
      end

      it { is_expected.to be_success }

      it "returns hydrated buckets for months that have activity" do
        months = result.value!.map { |summary| [summary.year, summary.month] }
        expect(months.first).to eq([2026, 6])
        expect(months).to include([2026, 6], [2026, 7])
      end

      it "hydrates FX-based totals onto the buckets" do
        june = result.value!.find { |summary| summary.year == 2026 && summary.month == 6 }

        expect(june.fx_based).to be(true)
        expect(june.total_expenses.to_d).to be > 0
      end
    end

    context "when a date range is provided" do
      let(:params) do
        {
          space_id: space.id,
          start_date: "2026-07-01",
          end_date: "2026-07-31"
        }
      end

      before do
        create(
          :expense_transaction,
          space:,
          user:,
          account:,
          category: expense_category,
          date: Date.new(2026, 6, 15),
          amount_cents: 10_000,
          balance_state: :calculated
        )
        create(
          :expense_transaction,
          space:,
          user:,
          account:,
          category: expense_category,
          date: Date.new(2026, 7, 20),
          amount_cents: 20_000,
          balance_state: :calculated
        )
      end

      it "returns only summaries overlapping the requested range" do
        months = result.value!.map { |summary| [summary.year, summary.month] }
        expect(months).to eq([[2026, 7]])
      end
    end
  end
end
