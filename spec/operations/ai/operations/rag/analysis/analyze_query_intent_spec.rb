# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Operations::Rag::Analysis::AnalyzeQueryIntent, type: :operation do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let!(:space_user) { create(:space_user, user: user, space: space) }
  let(:query) { "What's my biggest expense this month?" }
  let(:space_id) { space.id }

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

    let(:openai_response) do
      {
        "choices" => [
          {
            "message" => {
              "content" => '{
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
                "limit": 1
              }'
            }
          }
        ]
      }
    end

    before do
      # Mock OpenAI client
      openai_client = instance_double(OpenAI::Client)
      allow(OpenAI::Client).to receive(:new).and_return(openai_client)
      allow(openai_client).to receive(:chat).and_return(openai_response)
    end

    context "when all steps succeed" do
      it "successfully analyzes query intent and returns requirements" do
        result = operation.call(params)
        expect(result).to be_success

        response = result.value!
        expect(response).to include(
          :requirements,
          :raw_ai_analysis,
          :parsed_analysis
        )

        expect(response[:requirements]).to include(
          query_type: "spending_analysis",
          data_sources: ["transactions"],
          aggregations: hash_including(group_by: ["category"]),
          filters: hash_including(transaction_type: ["expense"]),
          time_range: hash_including(period: "this_month"),
          sorting: hash_including(field: "amount", direction: "desc"),
          limit: 1
        )
      end

      it "includes raw AI response in the result" do
        result = operation.call(params)
        expect(result).to be_success

        response = result.value!
        expect(response[:raw_ai_analysis]).to be_present
        expect(response[:raw_ai_analysis]).to include("query_type")
      end

      it "includes parsed analysis in the result" do
        result = operation.call(params)
        expect(result).to be_success

        response = result.value!
        expect(response[:parsed_analysis]).to be_present
        expect(response[:parsed_analysis]).to include(:query_type)
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
        openai_client = instance_double(OpenAI::Client)
        allow(OpenAI::Client).to receive(:new).and_return(openai_client)
        allow(openai_client).to receive(:chat).and_raise(StandardError.new("API error"))
      end

      it "returns a failure" do
        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:analysis_error)
        expect(result.failure[:analysis_error]).to include("Failed to analyze query intent")
      end
    end

    context "when OpenAI returns invalid JSON" do
      let(:openai_response) do
        {
          "choices" => [
            {
              "message" => {
                "content" => "Invalid JSON response"
              }
            }
          ]
        }
      end

      it "falls back to default analysis" do
        result = operation.call(params)
        expect(result).to be_success

        response = result.value!
        expect(response[:requirements][:query_type]).to eq("spending_analysis")
        expect(response[:requirements][:data_sources]).to eq(["transactions"])
        expect(response[:requirements][:time_range][:period]).to eq("this_month")
      end
    end
  end

  describe "private methods" do
    describe "#analyze_query_intent" do
      let(:params) do
        {
          query: query,
          space_id: space_id
        }
      end

      let(:openai_response) do
        {
          "choices" => [
            {
              "message" => {
                "content" => '{"query_type": "spending_analysis"}'
              }
            }
          ]
        }
      end

      before do
        openai_client = instance_double(OpenAI::Client)
        allow(OpenAI::Client).to receive(:new).and_return(openai_client)
        allow(openai_client).to receive(:chat).and_return(openai_response)
      end

      it "returns success with parsed analysis and raw response" do
        result = operation.send(:analyze_query_intent, params: params)
        expect(result).to be_success

        response = result.value!
        expect(response).to include(:parsed_analysis, :raw_response)
        expect(response[:parsed_analysis][:query_type]).to eq("spending_analysis")
        expect(response[:raw_response]).to include("query_type")
      end

      it "calls OpenAI with correct parameters" do
        openai_client = instance_double(OpenAI::Client)
        allow(OpenAI::Client).to receive(:new).and_return(openai_client)
        allow(openai_client).to receive(:chat).and_return(openai_response)

        operation.send(:analyze_query_intent, params: params)

        expect(openai_client).to have_received(:chat).with(
          parameters: hash_including(
            model: "gpt-3.5-turbo",
            messages: array_including(
              hash_including(role: "system"),
              hash_including(role: "user", content: query)
            ),
            temperature: 0.1,
            max_tokens: 1000
          )
        )
      end

      it "returns failure when OpenAI API fails" do
        openai_client = instance_double(OpenAI::Client)
        allow(OpenAI::Client).to receive(:new).and_return(openai_client)
        allow(openai_client).to receive(:chat).and_raise(StandardError.new("API error"))

        result = operation.send(:analyze_query_intent, params: params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:analysis_error)
        expect(result.failure[:analysis_error]).to include("Failed to analyze query intent")
      end
    end

    describe "#determine_data_requirements" do
      let(:analysis) do
        {
          query_type: "spending_analysis",
          data_sources: ["transactions"],
          aggregations: { group_by: ["category"], metrics: ["sum"] },
          filters: { transaction_type: ["expense"] },
          time_range: { period: "this_month" },
          sorting: { field: "amount", direction: "desc" },
          limit: 10
        }
      end

      it "returns success with requirements" do
        result = operation.send(:determine_data_requirements, analysis: analysis)
        expect(result).to be_success

        requirements = result.value!
        expect(requirements).to include(
          query_type: "spending_analysis",
          data_sources: ["transactions"],
          aggregations: { group_by: ["category"], metrics: ["sum"] },
          filters: { transaction_type: ["expense"] },
          time_range: { period: "this_month" },
          sorting: { field: "amount", direction: "desc" },
          limit: 10
        )
      end
    end

    describe "#build_analysis_prompt" do
      it "returns a prompt with current date context" do
        prompt = operation.send(:build_analysis_prompt)

        expect(prompt).to include("CURRENT DATE CONTEXT:")
        expect(prompt).to include(Date.current.strftime("%B %d, %Y"))
        expect(prompt).to include(Date.current.year.to_s)
        expect(prompt).to include(Date.current.strftime("%B"))
      end

      it "includes smart date inference rules" do
        prompt = operation.send(:build_analysis_prompt)

        expect(prompt).to include("SMART DATE INFERENCE:")
        expect(prompt).to include("most recent occurrence")
        expect(prompt).to include("this month")
        expect(prompt).to include("last month")
      end

      it "includes JSON response format instructions" do
        prompt = operation.send(:build_analysis_prompt)

        expect(prompt).to include("query_type")
        expect(prompt).to include("data_sources")
        expect(prompt).to include("aggregations")
        expect(prompt).to include("filters")
        expect(prompt).to include("time_range")
        expect(prompt).to include("sorting")
        expect(prompt).to include("limit")
      end

      it "includes examples" do
        prompt = operation.send(:build_analysis_prompt)

        expect(prompt).to include("Examples:")
        expect(prompt).to include("What's my biggest spend")
        expect(prompt).to include("How much did I spend on coffee")
        expect(prompt).to include("Show my top 5 merchants")
      end
    end

    describe "#parse_analysis_response" do
      context "with valid JSON response" do
        let(:response_text) do
          '{
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
            "limit": 5
          }'
        end

        it "returns parsed analysis" do
          result = operation.send(:parse_analysis_response, response_text)

        expect(result).to include(
          query_type: "spending_analysis",
          data_sources: ["transactions"],
          aggregations: { group_by: ["category"], metrics: ["sum", "count"] },
          filters: { transaction_type: ["expense"] },
          time_range: { period: "this_month" },
          sorting: { field: "amount", direction: "desc" },
          limit: 5
        )
        end
      end

      context "with invalid JSON response" do
        let(:response_text) { "Invalid JSON response" }

        it "returns default analysis" do
          result = operation.send(:parse_analysis_response, response_text)

          expect(result).to include(
            query_type: "spending_analysis",
            data_sources: ["transactions"],
            aggregations: { group_by: ["category"], metrics: ["sum", "count"] },
            filters: { transaction_type: ["expense"] },
            time_range: hash_including(period: "this_month"),
            sorting: { field: "amount", direction: "desc" },
            limit: 10
          )
        end
      end

      context "with missing fields in JSON" do
        let(:response_text) do
          '{
            "query_type": "income_analysis"
          }'
        end

        it "fills in missing fields with defaults" do
          result = operation.send(:parse_analysis_response, response_text)

          expect(result[:query_type]).to eq("income_analysis")
          expect(result[:data_sources]).to eq([])
          expect(result[:aggregations]).to eq({})
          expect(result[:filters]).to eq({})
          expect(result[:time_range]).to eq({ period: "this_month" })
          expect(result[:sorting]).to eq({ field: "amount", direction: "desc" })
          expect(result[:limit]).to eq(10)
        end
      end

      context "with limit exceeding maximum" do
        let(:response_text) do
          '{
            "query_type": "spending_analysis",
            "limit": 100
          }'
        end

        it "caps limit at 50" do
          result = operation.send(:parse_analysis_response, response_text)
          expect(result[:limit]).to eq(50)
        end
      end
    end

    describe "#default_analysis" do
      it "returns default analysis with current month context" do
        result = operation.send(:default_analysis)

        expect(result).to include(
          query_type: "spending_analysis",
          data_sources: ["transactions"],
          aggregations: { group_by: ["category"], metrics: ["sum", "count"] },
          filters: { transaction_type: ["expense"] },
          time_range: hash_including(period: "this_month"),
          sorting: { field: "amount", direction: "desc" },
          limit: 10
        )

        # Check that time_range includes current month dates
        current_date = Date.current
        expect(result[:time_range][:start_date]).to eq(current_date.beginning_of_month.strftime("%Y-%m-%d"))
        expect(result[:time_range][:end_date]).to eq(current_date.end_of_month.strftime("%Y-%m-%d"))
      end
    end
  end
end
