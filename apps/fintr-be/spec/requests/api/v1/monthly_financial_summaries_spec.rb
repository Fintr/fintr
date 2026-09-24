# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::MonthlyFinancialSummaries", type: :request do
  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) }
  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers].merge({ "Accept" => "application/json" }) }

  describe "GET /api/v1/monthly_financial_summaries" do
    let(:mock_operation) do
      instance_double(MonthlyFinancialSummaries::Operations::ListForSpace)
    end

    context "when the operation is successful" do
      let!(:summary) do
        create(
          :monthly_financial_summary,
          space:,
          year: 2026,
          month: 7,
          total_income: 1000,
          total_expenses: 400,
          net_savings: 600
        )
      end

      before do
        allow(MonthlyFinancialSummaries::Operations::ListForSpace).to receive(:new)
          .and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(
          Dry::Monads::Result::Success.new([summary])
        )

        get api_v1_monthly_financial_summaries_path, headers: headers
      end

      it "returns an HTTP status ok" do
        expect(response).to have_http_status(:ok)
      end

      it "calls ListForSpace with the current space" do
        expect(mock_operation).to have_received(:call).with(
          hash_including(
            space_id: space.id,
            space_code: space.code,
            user_id: user.id
          )
        ).once
      end

      it "returns serialized monthly financial summaries" do
        body = JSON.parse(response.body)
        rows = body.dig("data", "monthlyFinancialSummaries")

        expect(body["success"]).to be(true)
        expect(rows).to be_an(Array)
        expect(rows.first).to include(
          "year" => 2026,
          "month" => 7,
          "monthStartDate" => "2026-07-01",
          "monthEndDate" => "2026-07-31"
        )
      end
    end

    context "when the operation fails" do
      before do
        allow(MonthlyFinancialSummaries::Operations::ListForSpace).to receive(:new)
          .and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(
          Dry::Monads::Result::Failure.new(space_id: "not found")
        )

        get api_v1_monthly_financial_summaries_path, headers: headers
      end

      it "returns unprocessable content" do
        expect(response).to have_http_status(:unprocessable_content)
      end
    end

    context "when the request is unauthenticated" do
      before do
        get api_v1_monthly_financial_summaries_path,
            headers: { "Accept" => "application/json" }
      end

      it "returns unauthorized" do
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
