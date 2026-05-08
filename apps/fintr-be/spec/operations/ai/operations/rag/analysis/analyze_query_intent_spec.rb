# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Operations::Rag::Analysis::AnalyzeQueryIntent, type: :operation do
  subject(:operation) { described_class.new(provider: mock_provider) }

  let(:mock_provider) { instance_double(Ai::Providers::BaseProvider) }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let!(:space_user) { create(:space_user, user: user, space: space) }
  let(:category1) { create(:category, space: space, name: "Food & Groceries", category_type: "expense") }
  let(:category2) { create(:category, space: space, name: "Transportation", category_type: "expense") }
  let(:query) { "What's my biggest expense this month?" }
  let(:space_id) { space.id.to_s }

  before do
    allow(Ai::Providers::ProviderFactory).to receive(:create).and_return(mock_provider)
  end

  describe "Contract" do
    let(:params) do
      {
        query: query,
        space_id: space_id
      }
    end

    it "succeeds with valid parameters" do
      result = operation.validate(params: params)
      expect(result).to be_success
    end

    it "fails without query" do
      params.delete(:query)
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:query)
    end

    it "fails without space_id" do
      params.delete(:space_id)
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:space_id)
    end

    it "fails with invalid query type" do
      params[:query] = 123
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:query)
    end

    it "fails with invalid space_id type" do
      params[:space_id] = 123
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:space_id)
    end
  end

  describe "#call" do
    let(:params) do
      {
        query: query,
        space_id: space_id
      }
    end

    let(:llm_response) do
      {
        content: '{
          "query_type": "spending_analysis",
          "data_sources": ["transactions"],
          "aggregations": {
            "group_by": ["category"],
            "metrics": ["sum", "count"]
          },
          "filters": {
            "transaction_type": ["expense"]
          },
          "time_range": {
            "period": "this_month"
          },
          "sorting": {
            "field": "amount",
            "direction": "desc"
          },
          "limit": 10
        }',
        role: "assistant"
      }
    end

    before do
      category1
      category2
      allow(mock_provider).to receive(:chat).and_return(llm_response)
    end

    context "when all steps succeed" do
      it "successfully analyzes query intent and returns requirements" do
        result = operation.call(params)
        expect(result).to be_success

        response = result.value!
        # Operation now returns the analysis hash directly, not wrapped
        expect(response).to include(
          :query_type,
          :data_sources,
          :aggregations,
          :filters,
          :time_range,
          :sorting,
          :limit
        )

        expect(response[:query_type]).to eq("spending_analysis")
        expect(response[:data_sources]).to eq(["transactions"])
        expect(response[:aggregations]).to include(group_by: ["category"])
        expect(response[:filters]).to include(transaction_type: ["expense"])
        expect(response[:time_range]).to include(period: "this_month")
        expect(response[:sorting]).to include(field: "amount", direction: "desc")
        expect(response[:limit]).to eq(10)
      end

      it "includes all expected analysis fields" do
        result = operation.call(params)
        expect(result).to be_success

        response = result.value!
        # The operation returns the analysis hash with all the standard fields
        expect(response).to include(:query_type, :data_sources, :time_range)
      end

      it "includes additional analysis details" do
        result = operation.call(params)
        expect(result).to be_success

        response = result.value!
        # The operation returns structured analysis data
        expect(response).to include(:aggregations, :filters, :sorting, :limit)
      end
    end

    context "when validate fails" do
      let(:params) { { query: nil, space_id: space_id } }

      it "returns a failure" do
        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:query)
      end
    end

    context "when analyze_query_intent fails" do
      before do
        allow(mock_provider).to receive(:chat).and_raise(StandardError.new("API error"))
      end

      it "returns a failure" do
        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:llm_error)
        expect(result.failure[:llm_error]).to eq("API error")
      end
    end

    context "when OpenAI returns invalid JSON" do
      let(:llm_response) do
        {
          content: "Invalid JSON response",
          role: "assistant"
        }
      end

      it "falls back to default analysis" do
        result = operation.call(params)
        expect(result).to be_success

        response = result.value!
        # Operation returns analysis hash directly
        expect(response[:query_type]).to eq("spending_analysis")
        expect(response[:data_sources]).to eq(["transactions"])
        expect(response[:time_range][:period]).to eq("this_month")
      end
    end
  end
end
