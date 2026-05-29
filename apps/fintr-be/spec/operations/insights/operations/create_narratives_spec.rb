# frozen_string_literal: true

require "rails_helper"

RSpec.describe Insights::Operations::CreateNarratives, type: :operation do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let(:start_date) { Date.new(2024, 1, 1) }
  let(:end_date) { Date.new(2024, 1, 31) }

  let(:summary_structure) do
    {
      total_income: Utils::Number.format_number(10_000),
      total_expenses: Utils::Number.format_number(7_000),
      net_savings: Utils::Number.format_number(3_000)
    }
  end

  let(:health_scores) do
    {
      savings_percentage: { percentage: "30%", score: 100 },
      debt_to_income_ratio: { percentage: "0%", score: 100, monthly_debt: "0" },
      budget_usage: { percentage: "80%", score: 100 },
      financial_health_score: "95%"
    }
  end

  let(:params) do
    {
      space:,
      transactions: Transactions::Transaction.none,
      prior_transactions: Transactions::Transaction.none,
      budgets: [],
      budget_records: [],
      summary_structure:,
      health_scores:,
      is_business: false,
      start_date:,
      end_date:,
      period_days: 31
    }
  end

  describe "#call" do
    subject(:result) { operation.call(**params) }

    it { is_expected.to be_success }

    it "returns headline, metrics, insights, and data quality" do
      value = result.value!
      expect(value[:headline][:text]).to be_present
      expect(value[:metrics]).to be_an(Array)
      expect(value[:insights]).to be_an(Array)
      expect(value[:data_quality][:completeness_tier]).to eq("sparse")
    end

    it "includes calculation breakdowns with exact values on each metric" do
      metrics = result.value![:metrics]
      savings = metrics.find { |m| m[:key] == "savings_rate" }

      expect(savings[:calculation]).to include(:labeled_formula, :inputs, :notes)
      expect(savings[:calculation][:labeled_formula]).to eq("(Net savings ÷ Total income) × 100")
      expect(savings[:calculation][:formula]).to include("÷")
      expect(savings[:calculation][:inputs]).to include(
        hash_including(label: "Total income", value: be_present),
        hash_including(label: "Total expenses", value: be_present),
        hash_including(label: "Net savings", value: be_present)
      )
      expect(savings[:calculation][:formula]).to include("÷")
    end

    it "uses a 12-month lookback for emergency fund average monthly expenses" do
      lookback_start = operation.send(
        :emergency_fund_lookback_start_date,
        end_date:
      )
      expect(lookback_start).to eq(end_date - 12.months + 1.day)

      allow(operation).to receive(:find_emergency_fund_transactions).and_return(
        Success(Transactions::Transaction.none)
      )
      allow(Insights::Operations::CreateSummaryStructure).to receive(:new).and_return(
        instance_double(
          Insights::Operations::CreateSummaryStructure,
          call: Success(
            total_income: Utils::Number.format_number(0),
            total_expenses: Utils::Number.format_number(12_000),
            net_savings: Utils::Number.format_number(-12_000)
          )
        )
      )
      allow(space.accounts).to receive_message_chain(:kept, :sum).and_return(12_000_00)

      trailing = operation.send(:resolve_emergency_fund_expenses, params:)
      expect(trailing).to be_success
      expect(trailing.value!).to eq(12_000.to_d)

      emergency = operation.send(
        :emergency_fund_months,
        space:,
        trailing_expenses: trailing.value!
      )
      expect(emergency.value![:monthly_expenses]).to eq(1_000.to_d)

      metrics = result.value![:metrics]
      emergency_metric = metrics.find { |m| m[:key] == "emergency_fund" }

      expect(emergency_metric[:calculation][:notes].first).to include("12 months")
      expect(emergency_metric[:calculation][:notes].first).not_to include("1.0 months")
      expect(emergency_metric[:calculation][:inputs]).to include(
        hash_including(label: "Expenses (last 12 months)")
      )
    end

    context "when transactions use FilteredTransactions custom select" do
      let(:params) do
        super().merge(
          transactions: Transactions::Queries::FilteredTransactions.call(
            params: {
              space_code: space.code,
              start_date:,
              end_date:,
              balance_state: "calculated",
              paginate: false,
              without_initial_balance: true
            }
          ).value!
        )
      end

      it "counts transactions without invalid SQL" do
        expect(result).to be_success
        expect(result.value![:data_quality][:transaction_count]).to be >= 0
      end
    end
  end

  describe "#category_spike_insights" do
    it "returns a category trend card with a category-scoped transactions link" do
      current_transactions = instance_double(ActiveRecord::Relation)
      prior_transactions = instance_double(ActiveRecord::Relation)

      allow(operation).to receive(:expenses_by_category)
        .with(transactions: current_transactions, space: params[:space])
        .and_return({ "Subscriptions & Hobbies" => 200.to_d })
      allow(operation).to receive(:expenses_by_category)
        .with(transactions: prior_transactions, space: params[:space])
        .and_return({ "Subscriptions & Hobbies" => 100.to_d })

      spikes = operation.send(
        :category_spike_insights,
        transactions: current_transactions,
        prior_transactions:,
        space: params[:space]
      )

      expect(spikes.length).to eq(1)
      expect(spikes.first[:type]).to eq("category_trend")
      expect(spikes.first[:action_label]).to eq("Filter transactions")
      expect(spikes.first[:action_href]).to eq(
        "/dashboard?category=Subscriptions+%26+Hobbies"
      )
    end
  end

  describe "#transactions_filter_href" do
    it "encodes the category in the dashboard transactions URL" do
      href = operation.send(
        :transactions_filter_href,
        category_name: "Subscriptions & Hobbies"
      )

      expect(href).to eq("/dashboard?category=Subscriptions+%26+Hobbies")
    end

    it "returns plain dashboard when category is blank" do
      expect(operation.send(:transactions_filter_href, category_name: nil)).to eq("/dashboard")
    end
  end
end
