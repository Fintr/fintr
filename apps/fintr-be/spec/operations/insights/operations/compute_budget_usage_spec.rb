# frozen_string_literal: true

require "rails_helper"

RSpec.describe Insights::Operations::ComputeBudgetUsage, type: :operation do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let(:category) { create(:category, space:, category_type: "expense", name: "Food") }
  let(:account) { create(:account, space:) }

  let(:budget_records) do
    [
      create(
        :budget,
        space:,
        category:,
        date: Date.new(2024, 4, 1),
        amount_cents: 100_000
      ),
      create(
        :budget,
        space:,
        category: create(:category, space:, category_type: "expense", name: "Transport"),
        date: Date.new(2024, 4, 1),
        amount_cents: 200_000
      )
    ]
  end

  let!(:expense) do
    create(
      :expense_transaction,
      space:,
      user:,
      account:,
      category:,
      date: Date.new(2024, 4, 10),
      amount_cents: 150_000,
      balance_state: :calculated
    )
  end

  let(:transactions) do
    Transactions::Transaction.where(id: expense.id)
  end

  describe "#call" do
    subject(:result) do
      operation.call(
        budget_records:,
        transactions:,
        space:
      )
    end

    it { is_expected.to be_success }

    it "returns aligned budget usage figures" do
      value = result.value!
      expect(value[:total_budget]).to eq(3_000.to_d)
      expect(value[:total_expenses]).to eq(1_500.to_d)
      expect(value[:usage_percentage]).to eq(50.to_d)
      expect(value[:remaining]).to eq(1_500.to_d)
      expect(value[:over_amount]).to eq(0.to_d)
    end

    context "when spending exceeds budget" do
      before do
        create(
          :expense_transaction,
          space:,
          user:,
          account:,
          category:,
          date: Date.new(2024, 4, 12),
          amount_cents: 200_000,
          balance_state: :calculated
        )
      end

      let(:transactions) do
        Transactions::Transaction.where(space:)
      end

      it "reports over amount and usage above 100%" do
        value = result.value!
        expect(value[:usage_percentage]).to be > 100
        expect(value[:over_amount]).to be_positive
        expect(value[:remaining]).to be_negative
      end
    end

    context "when budgets are stored in a different currency than the space" do
      let(:space) { create(:personal_space, users: [user], currency: "GBP") }
      let(:rate_date) { Date.new(2024, 4, 10) }

      let(:budget_records) do
        [
          create(
            :budget,
            space:,
            category:,
            date: Date.new(2024, 4, 10),
            amount_cents: 100_000,
            amount_currency: "PHP"
          )
        ]
      end

      before do
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: "USD",
          target_currency: "PHP",
          rate: 58.0,
          rate_date: rate_date
        )
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: "USD",
          target_currency: "GBP",
          rate: 0.79,
          rate_date: rate_date
        )
      end

      it "converts budget totals into the space currency before comparing expenses" do
        value = result.value!
        expect(value[:total_budget]).to be_within(0.02).of(13.62)
        expect(value[:total_expenses]).to be_within(0.02).of(20.43)
      end
    end
  end
end
