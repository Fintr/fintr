# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Insights sections", type: :request do
  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) }
  let!(:subscription_plan) { create(:subscription_plan, slug: "pro-#{SecureRandom.hex(4)}") }
  let!(:space_subscription) do
    create(
      :space_subscription,
      space:,
      subscription_plan:,
      status: :active,
      subscription_type: :paid,
    )
  end
  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers].merge({ "Accept" => "application/json" }) }
  let(:request_params) { { space_code: space.code, start_date: "2024-01-01", end_date: "2024-01-31" } }

  describe "GET /api/v1/insights/summary" do
    let(:mock_resolve_context) { instance_double(Insights::Operations::ResolveContext) }
    let(:mock_summary_op) { instance_double(Insights::Operations::CreateSummaryStructure) }
    let(:context_value) do
      {
        space:,
        transactions: Transactions::Transaction.none,
        prior_transactions: Transactions::Transaction.none,
        budgets: [],
        is_business: false,
        start_date: Date.new(2024, 1, 1),
        end_date: Date.new(2024, 1, 31),
        period_days: 31
      }
    end

    before do
      allow(Insights::Operations::ResolveContext).to receive(:new).and_return(mock_resolve_context)
      allow(mock_resolve_context).to receive(:call).and_return(Dry::Monads::Result::Success.new(context_value))
      allow(Insights::Operations::CreateSummaryStructure).to receive(:new).and_return(mock_summary_op)
      allow(mock_summary_op).to receive(:call).and_return(
        Dry::Monads::Result::Success.new(
          total_income: "1000",
          total_expenses: "500",
          net_savings: "500"
        )
      )

      get "/api/v1/insights/summary", params: request_params, headers: headers
    end

    it "returns summary data" do
      expect(response).to have_http_status(:ok)
      json_response = JSON.parse(response.body)
      expect(json_response["success"]).to be(true)
      expect(json_response["data"]["totalIncome"]).to eq("1000")
    end
  end

  describe "without Fintr Pro" do
    let(:mock_resolve_context) { instance_double(Insights::Operations::ResolveContext) }
    let(:context_value) do
      {
        space:,
        transactions: Transactions::Transaction.none,
        prior_transactions: Transactions::Transaction.none,
        budgets: [],
        budget_records: [],
        is_business: false,
        start_date: Date.new(2024, 1, 1),
        end_date: Date.new(2024, 1, 31),
        period_days: 31,
        category_filtered: false,
      }
    end

    before do
      user.update!(trial_ends_at: 1.day.ago)
      space_subscription.destroy!
      allow(Insights::Operations::ResolveContext).to receive(:new).and_return(mock_resolve_context)
      allow(mock_resolve_context).to receive(:call).and_return(
        Dry::Monads::Result::Success.new(context_value)
      )
    end

    it "returns the income and expense summary" do
      summary_op = instance_double(Insights::Operations::CreateSummaryStructure)
      allow(Insights::Operations::CreateSummaryStructure).to receive(:new).and_return(summary_op)
      allow(summary_op).to receive(:call).and_return(
        Dry::Monads::Result::Success.new(
          total_income: "1000",
          total_expenses: "400",
          net_savings: "600",
        )
      )

      get "/api/v1/insights/summary", params: request_params, headers: headers

      expect(response).to have_http_status(:ok)
    end

    it "returns financial trends" do
      get "/api/v1/insights/monthly_spending", params: request_params, headers: headers

      expect(response).to have_http_status(:ok)
    end

    it "returns key metrics without narrative insights" do
      narratives_op = instance_double(Insights::Operations::CreateNarratives)
      allow(Insights::Operations::CreateNarratives).to receive(:new).and_return(narratives_op)
      allow(narratives_op).to receive(:call).and_return(
        Dry::Monads::Result::Success.new(
          headline: { text: "Steady", sentiment: "neutral" },
          metrics: [{ key: "savings_rate", label: "Savings rate", value: "20%" }],
          insights: [{ type: "savings", title: "Strong Saver" }],
          data_quality: { transaction_count: 1 },
        )
      )

      get "/api/v1/insights/narratives", params: request_params, headers: headers

      json_response = JSON.parse(response.body)
      expect(json_response["data"]["metrics"].first["key"]).to eq("savings_rate")
      expect(json_response["data"]["insights"]).to eq([])
    end

    it "requires Pro for the financial health score" do
      get "/api/v1/insights/health_scores", params: request_params, headers: headers

      expect(response).to have_http_status(:forbidden)
    end

    it "requires Pro for the expense breakdown" do
      get "/api/v1/insights/expense_breakdown", params: request_params, headers: headers

      expect(response).to have_http_status(:forbidden)
    end

    it "requires Pro for weekly spending" do
      get "/api/v1/insights/weekly_spending", params: request_params, headers: headers

      expect(response).to have_http_status(:forbidden)
    end
  end
end
