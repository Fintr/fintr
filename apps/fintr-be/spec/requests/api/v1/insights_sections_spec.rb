# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Insights sections", type: :request do
  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) }
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
end
