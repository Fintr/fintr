# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Operations::Rag::ProcessStreamingRagQuery, type: :operation do
  subject(:operation) { described_class.new }

  let(:space_id) { SecureRandom.uuid }
  let(:query) { "What are my spending patterns this month?" }
  let(:params) do
    {
      query: query,
      space_id: space_id
    }
  end

  describe "Contract" do
    it "succeeds with valid parameters" do
      result = operation.validate(params: params)
      expect(result).to be_success
      expect(result.value!).to eq(params)
    end

    it "fails without a query" do
      params_without_query = params.except(:query)
      result = operation.validate(params: params_without_query)
      expect(result).to be_failure
      expect(result.failure).to have_key(:query)
    end

    it "fails without a space_id" do
      params_without_space_id = params.except(:space_id)
      result = operation.validate(params: params_without_space_id)
      expect(result).to be_failure
      expect(result.failure).to have_key(:space_id)
    end

    it "fails with invalid query type" do
      params_with_invalid_query = params.merge(query: 123)
      result = operation.validate(params: params_with_invalid_query)
      expect(result).to be_failure
      expect(result.failure).to have_key(:query)
    end

    it "fails with invalid space_id type" do
      params_with_invalid_space_id = params.merge(space_id: 123)
      result = operation.validate(params: params_with_invalid_space_id)
      expect(result).to be_failure
      expect(result.failure).to have_key(:space_id)
    end
  end

  describe "#call" do
    let(:analysis_result) do
      {
        requirements: {
          query_type: "spending_analysis",
          time_period: "current_month",
          categories: ["all"]
        },
        raw_ai_analysis: "AI analysis response"
      }
    end

    let(:structured_data) do
      {
        query_type: "spending_analysis",
        data_summary: "Total spending: $1,500",
        raw_data: [
          {
            group: ["Food", "Groceries"],
            sum: { amount: "$500.00" },
            count: 15
          }
        ]
      }
    end

    let(:search_results) do
      {
        results: [
          {
            content: "Recent transaction data",
            similarity_score: 0.85
          }
        ]
      }
    end

    before do
      # Mock the dependent operations
      allow(Ai::Operations::Rag::Analysis::AnalyzeQueryIntent).to receive(:new) do |*args|
        instance_double(Ai::Operations::Rag::Analysis::AnalyzeQueryIntent).tap do |op|
          allow(op).to receive(:call).and_return(Success(analysis_result))
        end
      end

      allow(Ai::Operations::Rag::Data::RetrieveStructuredData).to receive(:new) do |*args|
        instance_double(Ai::Operations::Rag::Data::RetrieveStructuredData).tap do |op|
          allow(op).to receive(:call).and_return(Success(structured_data))
        end
      end

      allow(Ai::Operations::Rag::SearchVectors).to receive(:new) do |*args|
        instance_double(Ai::Operations::Rag::SearchVectors).tap do |op|
          allow(op).to receive(:call).and_return(Success(search_results))
        end
      end
    end

    it "successfully processes the RAG query and returns enhanced prompt data" do
      result = operation.call(params)
      expect(result).to be_success

      result_data = result.value!
      expect(result_data).to include(
        enhanced_prompt: kind_of(String),
        structured_data: structured_data,
        search_results: search_results,
        data_requirements: analysis_result[:requirements],
        raw_ai_analysis: analysis_result[:raw_ai_analysis]
      )
    end

    it "calls all dependent operations with correct parameters" do
      operation.call(params)

      expect(Ai::Operations::Rag::Analysis::AnalyzeQueryIntent).to have_received(:new).with(no_args)
      expect(Ai::Operations::Rag::Data::RetrieveStructuredData).to have_received(:new).with(no_args)
      expect(Ai::Operations::Rag::SearchVectors).to have_received(:new).with(no_args)
    end

    it "passes correct parameters to analyze_query_intent" do
      analyze_intent_double = instance_double(Ai::Operations::Rag::Analysis::AnalyzeQueryIntent)
      allow(Ai::Operations::Rag::Analysis::AnalyzeQueryIntent).to receive(:new).and_return(analyze_intent_double)
      allow(analyze_intent_double).to receive(:call).and_return(Success(analysis_result))

      operation.call(params)

      expect(analyze_intent_double).to have_received(:call).with(
        query: query,
        space_id: space_id
      )
    end

    it "passes correct parameters to retrieve_structured_data" do
      retrieve_data_double = instance_double(Ai::Operations::Rag::Data::RetrieveStructuredData)
      allow(Ai::Operations::Rag::Data::RetrieveStructuredData).to receive(:new).and_return(retrieve_data_double)
      allow(retrieve_data_double).to receive(:call).and_return(Success(structured_data))

      operation.call(params)

      expect(retrieve_data_double).to have_received(:call).with(
        space_id: space_id,
        data_requirements: analysis_result[:requirements]
      )
    end

    it "passes correct parameters to perform_vector_search" do
      search_vectors_double = instance_double(Ai::Operations::Rag::SearchVectors)
      allow(Ai::Operations::Rag::SearchVectors).to receive(:new).and_return(search_vectors_double)
      allow(search_vectors_double).to receive(:call).and_return(Success(search_results))

      operation.call(params)

      expect(search_vectors_double).to have_received(:call).with(
        query: query,
        space_id: space_id,
        limit: 10,
        threshold: 0.7,
        embeddable_type: nil,
        filters: nil
      )
    end

    it "fails if analyze_query_intent fails" do
      allow(Ai::Operations::Rag::Analysis::AnalyzeQueryIntent).to receive(:new) do |*args|
        instance_double(Ai::Operations::Rag::Analysis::AnalyzeQueryIntent).tap do |op|
          allow(op).to receive(:call).and_return(Failure(analysis_error: "Analysis failed"))
        end
      end

      result = operation.call(params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:analysis_error)
    end

    it "fails if retrieve_structured_data fails" do
      allow(Ai::Operations::Rag::Data::RetrieveStructuredData).to receive(:new) do |*args|
        instance_double(Ai::Operations::Rag::Data::RetrieveStructuredData).tap do |op|
          allow(op).to receive(:call).and_return(Failure(data_error: "Data retrieval failed"))
        end
      end

      result = operation.call(params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:data_error)
    end

    it "fails if perform_vector_search fails" do
      allow(Ai::Operations::Rag::SearchVectors).to receive(:new) do |*args|
        instance_double(Ai::Operations::Rag::SearchVectors).tap do |op|
          allow(op).to receive(:call).and_return(Failure(search_error: "Search failed"))
        end
      end

      result = operation.call(params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:search_error)
    end
  end

  describe "private methods" do
    describe "#format_structured_data_for_prompt" do
      context "when raw_data is empty" do
        it "returns no data message" do
          structured_data = { raw_data: [] }
          result = operation.send(:format_structured_data_for_prompt, structured_data)
          expect(result).to eq("No relevant data found.")
        end
      end

      context "when query_type is spending_analysis" do
        it "formats spending data correctly" do
          structured_data = {
            query_type: "spending_analysis",
            raw_data: [
              {
                group: ["Food", "Groceries"],
                sum: { amount: "$500.00" },
                count: 15
              }
            ]
          }

          result = operation.send(:format_structured_data_for_prompt, structured_data)
          expect(result).to include("Food - Groceries: $500.00 (15 transactions)")
        end
      end

      context "when query_type is trend_analysis" do
        it "formats trend data correctly" do
          structured_data = {
            query_type: "trend_analysis",
            raw_data: [
              { period: "January", amount: "$1000" },
              { period: "February", amount: "$1200" }
            ]
          }

          result = operation.send(:format_structured_data_for_prompt, structured_data)
          expect(result).to include("January: $1000")
          expect(result).to include("February: $1200")
        end
      end

      context "when query_type is not spending or trend" do
        it "formats transaction data correctly" do
          structured_data = {
            query_type: "transaction_search",
            raw_data: [
              {
                date: "2024-01-15",
                description: "Coffee",
                amount: "$5.00",
                category: "Food",
                type: "expense"
              }
            ]
          }

          result = operation.send(:format_structured_data_for_prompt, structured_data)
          expect(result).to include("2024-01-15: Coffee - $5.00 (Food) [expense]")
        end
      end
    end

    describe "#format_spending_data" do
      context "with grouped data" do
        it "formats grouped spending data" do
          data = [
            {
              group: ["Food", "Groceries"],
              sum: { amount: "$500.00" },
              count: 15
            }
          ]

          result = operation.send(:format_spending_data, data)
          expect(result).to eq("Food - Groceries: $500.00 (15 transactions)")
        end
      end

      context "with individual transactions" do
        it "formats individual transaction data" do
          data = [
            {
              date: "2024-01-15",
              description: "Coffee",
              amount: "$5.00",
              category: "Food"
            }
          ]

          result = operation.send(:format_spending_data, data)
          expect(result).to eq("2024-01-15: Coffee - $5.00 (Food)")
        end
      end
    end

    describe "#format_trend_data" do
      it "formats trend data correctly" do
        data = [
          { period: "January", amount: "$1000" },
          { period: "February", amount: "$1200" }
        ]

        result = operation.send(:format_trend_data, data)
        expect(result).to eq("January: $1000\nFebruary: $1200")
      end
    end

    describe "#format_transaction_data" do
      it "formats transaction data correctly" do
        data = [
          {
            date: "2024-01-15",
            description: "Coffee",
            amount: "$5.00",
            category: "Food",
            type: "expense"
          }
        ]

        result = operation.send(:format_transaction_data, data)
        expect(result).to eq("2024-01-15: Coffee - $5.00 (Food) [expense]")
      end
    end
  end
end
