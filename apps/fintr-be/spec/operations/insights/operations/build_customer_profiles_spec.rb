# frozen_string_literal: true

require "rails_helper"

RSpec.describe Insights::Operations::BuildCustomerProfiles, type: :operation do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user], currency: "PHP") }
  let(:start_date) { Date.new(2024, 1, 1) }
  let(:end_date) { Date.new(2024, 1, 31) }
  let(:account) { create(:account, space:, account_category: "cash") }

  let(:summary_structure) do
    {
      total_income: Utils::Number.format_number(10_000),
      total_expenses: Utils::Number.format_number(7_000),
      net_savings: Utils::Number.format_number(3_000)
    }
  end

  let(:base_params) do
    {
      space:,
      transactions: Transactions::Transaction.none,
      prior_transactions: Transactions::Transaction.none,
      budget_records: [],
      summary_structure:,
      is_business: false,
      period_days: 31,
      start_date:,
      end_date:,
      completeness_tier: "complete"
    }
  end

  describe "#call" do
    it "returns no profiles when data is sparse" do
      result = operation.call(**base_params.merge(completeness_tier: "sparse"))

      expect(result).to be_success
      expect(result.value!).to eq([])
    end

    it "returns Strong Saver when savings rate is at least 20%" do
      result = operation.call(**base_params)

      expect(result).to be_success
      keys = result.value!.map { |card| card[:profile_key] }
      expect(keys).to include("strong_saver")
      saver = result.value!.find { |card| card[:profile_key] == "strong_saver" }
      expect(saver[:image_key]).to eq("strong_saver")
      expect(saver[:severity]).to eq("positive")
      expect(saver[:title]).to eq("Strong Saver")
    end

    it "returns Avid Spender when expenses are at least 70% of income" do
      result = operation.call(**base_params)

      keys = result.value!.map { |card| card[:profile_key] }
      expect(keys).to include("avid_spender")
    end

    it "returns High Earner when income rises at least 15% vs prior period" do
      prior_summary = {
        total_income: Utils::Number.format_number(5_000),
        total_expenses: Utils::Number.format_number(3_000),
        net_savings: Utils::Number.format_number(2_000)
      }
      allow(Insights::Operations::CreateSummaryStructure).to receive(:new).and_return(
        instance_double(
          Insights::Operations::CreateSummaryStructure,
          call: Dry::Monads::Success(prior_summary)
        )
      )

      result = operation.call(**base_params)
      keys = result.value!.map { |card| card[:profile_key] }
      expect(keys).to include("high_earner")
    end

    it "returns Steady Investor for investment-category expenses above the floor" do
      category = create(:category, space:, category_type: "expense", name: "Stocks & ETF")
      create(
        :expense_transaction,
        space:,
        user:,
        account:,
        category:,
        date: Date.new(2024, 1, 10),
        amount_cents: 200_000,
        balance_state: :calculated
      )

      result = operation.call(
        **base_params.merge(
          transactions: Transactions::Transaction.where(space:)
        )
      )

      keys = result.value!.map { |card| card[:profile_key] }
      expect(keys).to include("steady_investor")
    end

    it "orders profiles by priority with Strong Saver before Avid Spender" do
      result = operation.call(**base_params)
      keys = result.value!.map { |card| card[:profile_key] }

      expect(keys.index("strong_saver")).to be < keys.index("avid_spender")
    end
  end
end
