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
          categories: ["all"],
          data_sources: ["transactions"],
          filters: {},
          time_range: {},
          limit: 10,
          sorting: {
            field: "amount",
            direction: "desc"
          },
          chart_suggestion: "pie"
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
        user_query: nil, # Note: code uses params[:user_query] but params only has :query
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
        space_id: space_id,
        openai_conversation_id: nil
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
        limit: 20,
        threshold: 0.7,
        embeddable_type: "Transactions::Transaction",
        filters: nil,
        sort_by_amount: false
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
    describe "#perform_vector_search" do
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

      let(:requirements) do
        {
          query_type: "spending_analysis",
          data_sources: ["transactions"],
          filters: {},
          time_range: {}
        }
      end

      let(:search_vectors_double) do
        instance_double(Ai::Operations::Rag::SearchVectors).tap do |op|
          allow(op).to receive(:call).and_return(Success(search_results))
        end
      end

      before do
        allow(Ai::Operations::Rag::SearchVectors).to receive(:new).and_return(search_vectors_double)
      end

      it "calls SearchVectors with correct parameters" do
        operation.send(:perform_vector_search, params: params, requirements: requirements)

        expect(search_vectors_double).to have_received(:call).with(
          query: query,
          space_id: space_id,
          limit: 20,
          threshold: 0.7,
          embeddable_type: "Transactions::Transaction",
          filters: nil,
          sort_by_amount: false
        )
      end

      context "with transaction_search query type" do
        let(:requirements) do
          {
            query_type: "transaction_search",
            data_sources: ["transactions"],
            filters: {},
            time_range: {}
          }
        end

        it "uses adjusted search parameters" do
          operation.send(:perform_vector_search, params: params, requirements: requirements)

          expect(search_vectors_double).to have_received(:call).with(
            query: query,
            space_id: space_id,
            limit: 30,
            threshold: 0.6,
            embeddable_type: "Transactions::Transaction",
            filters: nil,
            sort_by_amount: false
          )
        end
      end

      context "with filters in requirements" do
        let(:requirements) do
          {
            query_type: "spending_analysis",
            data_sources: ["transactions"],
            filters: {
              transaction_type: ["expense"],
              categories: ["Food"],
              accounts: ["Cash"]
            },
            time_range: {
              start_date: "2024-01-01",
              end_date: "2024-01-31"
            }
          }
        end

        it "builds filters correctly" do
          operation.send(:perform_vector_search, params: params, requirements: requirements)

          expect(search_vectors_double).to have_received(:call).with(
            query: query,
            space_id: space_id,
            limit: 20,
            threshold: 0.7,
            embeddable_type: "Transactions::Transaction",
            filters: hash_including(
              transaction_type: "expense",
              category: "Food",
              account: "Cash",
              date_from: "2024-01-01",
              date_to: "2024-01-31"
            ),
            sort_by_amount: false
          )
        end
      end

      context "with sort_by_amount requirement" do
        let(:requirements) do
          {
            query_type: "transaction_search",
            data_sources: ["transactions"],
            sorting: {
              field: "amount",
              direction: "desc"
            }
          }
        end

        it "sets sort_by_amount to true" do
          operation.send(:perform_vector_search, params: params, requirements: requirements)

          expect(search_vectors_double).to have_received(:call).with(
            query: query,
            space_id: space_id,
            limit: 30,
            threshold: 0.6,
            embeddable_type: "Transactions::Transaction",
            filters: nil,
            sort_by_amount: true
          )
        end
      end
    end

    describe "#should_sort_by_amount?" do
      it "returns true when query_type is transaction_search and sorting by amount desc" do
        requirements = {
          query_type: "transaction_search",
          sorting: {
            field: "amount",
            direction: "desc"
          }
        }

        result = operation.send(:should_sort_by_amount?, requirements: requirements)
        expect(result).to be true
      end

      it "returns false when query_type is not transaction_search" do
        requirements = {
          query_type: "spending_analysis",
          sorting: {
            field: "amount",
            direction: "desc"
          }
        }

        result = operation.send(:should_sort_by_amount?, requirements: requirements)
        expect(result).to be false
      end

      it "returns false when sorting field is not amount" do
        requirements = {
          query_type: "transaction_search",
          sorting: {
            field: "date",
            direction: "desc"
          }
        }

        result = operation.send(:should_sort_by_amount?, requirements: requirements)
        expect(result).to be false
      end

      it "returns false when sorting direction is not desc" do
        requirements = {
          query_type: "transaction_search",
          sorting: {
            field: "amount",
            direction: "asc"
          }
        }

        result = operation.send(:should_sort_by_amount?, requirements: requirements)
        expect(result).to be false
      end

      it "handles missing sorting hash" do
        requirements = {
          query_type: "transaction_search"
        }

        result = operation.send(:should_sort_by_amount?, requirements: requirements)
        expect(result).to be false
      end
    end

    describe "#build_vector_search_filters" do
      it "returns nil when no filters are present" do
        requirements = {}
        result = operation.send(:build_vector_search_filters, requirements: requirements)
        expect(result).to be_nil
      end

      it "maps transaction_type filter" do
        requirements = {
          filters: {
            transaction_type: ["expense"]
          }
        }

        result = operation.send(:build_vector_search_filters, requirements: requirements)
        expect(result).to eq({ transaction_type: "expense" })
      end

      it "maps category filter" do
        requirements = {
          filters: {
            categories: ["Food"]
          }
        }

        result = operation.send(:build_vector_search_filters, requirements: requirements)
        expect(result).to eq({ category: "Food" })
      end

      it "maps account filter" do
        requirements = {
          filters: {
            accounts: ["Cash"]
          }
        }

        result = operation.send(:build_vector_search_filters, requirements: requirements)
        expect(result).to eq({ account: "Cash" })
      end

      it "maps time_range to date filters" do
        requirements = {
          time_range: {
            start_date: "2024-01-01",
            end_date: "2024-01-31"
          }
        }

        result = operation.send(:build_vector_search_filters, requirements: requirements)
        expect(result).to eq({
          date_from: "2024-01-01",
          date_to: "2024-01-31"
        })
      end

      it "handles time_range with only start_date" do
        requirements = {
          time_range: {
            start_date: "2024-01-01"
          }
        }

        result = operation.send(:build_vector_search_filters, requirements: requirements)
        expect(result).to eq({ date_from: "2024-01-01" })
      end

      it "combines multiple filters" do
        requirements = {
          filters: {
            transaction_type: ["expense"],
            categories: ["Food"],
            accounts: ["Cash"]
          },
          time_range: {
            start_date: "2024-01-01",
            end_date: "2024-01-31"
          }
        }

        result = operation.send(:build_vector_search_filters, requirements: requirements)
        expect(result).to include(
          transaction_type: "expense",
          category: "Food",
          account: "Cash",
          date_from: "2024-01-01",
          date_to: "2024-01-31"
        )
      end
    end

    describe "#determine_embeddable_type" do
      it "returns Transactions::Transaction when data_sources includes transactions" do
        requirements = { data_sources: ["transactions"] }
        result = operation.send(:determine_embeddable_type, requirements: requirements)
        expect(result).to eq("Transactions::Transaction")
      end

      it "returns Transfers::Transfer when data_sources includes transfers" do
        requirements = { data_sources: ["transfers"] }
        result = operation.send(:determine_embeddable_type, requirements: requirements)
        expect(result).to eq("Transfers::Transfer")
      end

      it "returns Budgets::Budget when data_sources includes budgets" do
        requirements = { data_sources: ["budgets"] }
        result = operation.send(:determine_embeddable_type, requirements: requirements)
        expect(result).to eq("Budgets::Budget")
      end

      it "returns Accounts::Account when data_sources includes accounts" do
        requirements = { data_sources: ["accounts"] }
        result = operation.send(:determine_embeddable_type, requirements: requirements)
        expect(result).to eq("Accounts::Account")
      end

      it "returns nil when data_sources is empty" do
        requirements = { data_sources: [] }
        result = operation.send(:determine_embeddable_type, requirements: requirements)
        expect(result).to be_nil
      end

      it "returns nil when data_sources is not present" do
        requirements = {}
        result = operation.send(:determine_embeddable_type, requirements: requirements)
        expect(result).to be_nil
      end

      it "prioritizes transactions over other types" do
        requirements = { data_sources: ["transactions", "budgets"] }
        result = operation.send(:determine_embeddable_type, requirements: requirements)
        expect(result).to eq("Transactions::Transaction")
      end
    end

    describe "#adjust_search_parameters" do
      it "returns [30, 0.6] for transaction_search" do
        requirements = { query_type: "transaction_search" }
        limit, threshold = operation.send(:adjust_search_parameters, requirements: requirements)
        expect(limit).to eq(30)
        expect(threshold).to eq(0.6)
      end

      it "returns [25, 0.65] for trend_analysis" do
        requirements = { query_type: "trend_analysis" }
        limit, threshold = operation.send(:adjust_search_parameters, requirements: requirements)
        expect(limit).to eq(25)
        expect(threshold).to eq(0.65)
      end

      it "returns [20, 0.7] for spending_analysis" do
        requirements = { query_type: "spending_analysis" }
        limit, threshold = operation.send(:adjust_search_parameters, requirements: requirements)
        expect(limit).to eq(20)
        expect(threshold).to eq(0.7)
      end

      it "returns [20, 0.7] for income_analysis" do
        requirements = { query_type: "income_analysis" }
        limit, threshold = operation.send(:adjust_search_parameters, requirements: requirements)
        expect(limit).to eq(20)
        expect(threshold).to eq(0.7)
      end

      it "returns [20, 0.7] as default for unknown query types" do
        requirements = { query_type: "unknown_type" }
        limit, threshold = operation.send(:adjust_search_parameters, requirements: requirements)
        expect(limit).to eq(20)
        expect(threshold).to eq(0.7)
      end
    end

    describe "#build_enhanced_prompt" do
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

      let(:requirements) do
        {
          query_type: "spending_analysis",
          limit: 10,
          sorting: {
            field: "amount",
            direction: "desc"
          },
          chart_suggestion: "pie"
        }
      end

      it "builds enhanced prompt with structured data and search results" do
        result = operation.send(:build_enhanced_prompt,
          structured_data: structured_data,
          search_results: search_results,
          params: params,
          requirements: requirements)

        expect(result).to be_success
        prompt = result.value!
        expect(prompt).to include("STRUCTURED FINANCIAL DATA")
        expect(prompt).to include("DATA FROM VECTOR SEARCH")
        expect(prompt).to include("QUERY ANALYSIS")
        expect(prompt).to include(query)
      end

      it "truncates long search result content" do
        long_content = "a" * 300
        search_results_with_long_content = {
          results: [
            {
              content: long_content,
              similarity_score: 0.85
            }
          ]
        }

        result = operation.send(:build_enhanced_prompt,
          structured_data: structured_data,
          search_results: search_results_with_long_content,
          params: params,
          requirements: requirements)

        expect(result).to be_success
        prompt = result.value!
        expect(prompt).to include("...")
      end

      it "limits search results to 15 items" do
        many_results = {
          results: (1..20).map do |i|
            {
              content: "Result #{i}",
              similarity_score: 0.85
            }
          end
        }

        result = operation.send(:build_enhanced_prompt,
          structured_data: structured_data,
          search_results: many_results,
          params: params,
          requirements: requirements)

        expect(result).to be_success
        prompt = result.value!
        # Should only include first 15 results
        expect(prompt.scan(/Result \d+/).length).to eq(15)
      end

      it "includes single result instruction for single result queries" do
        single_result_requirements = {
          query_type: "transaction_search",
          limit: 1,
          sorting: {
            field: "amount",
            direction: "desc"
          }
        }

        result = operation.send(:build_enhanced_prompt,
          structured_data: structured_data,
          search_results: search_results,
          params: params,
          requirements: single_result_requirements)

        expect(result).to be_success
        prompt = result.value!
        expect(prompt).to include("SINGLE result")
        expect(prompt).to include("biggest/largest/top expense")
      end

      it "returns no data prompt when both structured and vector data are empty" do
        empty_structured_data = {
          query_type: "spending_analysis",
          data_summary: "No data found",
          raw_data: []
        }
        empty_search_results = { results: [] }

        result = operation.send(:build_enhanced_prompt,
          structured_data: empty_structured_data,
          search_results: empty_search_results,
          params: params,
          requirements: requirements)

        expect(result).to be_success
        prompt = result.value!
        expect(prompt).to include("NO DATA available")
        expect(prompt).to include("I couldn't find any data matching your query")
      end

      it "returns no data prompt when structured context indicates no data" do
        no_data_structured_data = {
          query_type: "spending_analysis",
          data_summary: "No data found",
          raw_data: []
        }

        result = operation.send(:build_enhanced_prompt,
          structured_data: no_data_structured_data,
          search_results: { results: [] },
          params: params,
          requirements: requirements)

        expect(result).to be_success
        prompt = result.value!
        expect(prompt).to include("NO DATA available")
      end
    end

    describe "#build_no_data_prompt" do
      it "builds a prompt instructing the AI to tell the user no data was found" do
        requirements = { query_type: "spending_analysis" }
        result = operation.send(:build_no_data_prompt, params: params, requirements: requirements)

        expect(result).to include("NO DATA available")
        expect(result).to include(query)
        expect(result).to include("I couldn't find any data matching your query")
        expect(result).to include("Do NOT")
      end
    end

    describe "#format_structured_data_for_prompt" do
      context "when raw_data is empty" do
        it "returns no data message" do
          structured_data = { raw_data: [] }
          result = operation.send(:format_structured_data_for_prompt, structured_data, requirements: {})
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

          result = operation.send(:format_structured_data_for_prompt, structured_data, requirements: {})
          expect(result).to include("Food - Groceries")
          expect(result).to include("$500.00")
          expect(result).to include("15 transaction")
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

          result = operation.send(:format_structured_data_for_prompt, structured_data, requirements: {})
          expect(result).to include("January: $1000")
          expect(result).to include("February: $1200")
        end
      end

      context "when query_type is transaction_search" do
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

          result = operation.send(:format_structured_data_for_prompt, structured_data, requirements: {})
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

          result = operation.send(:format_spending_data, data, requirements: {})
          expect(result).to include("Food - Groceries: $500.00 (15 transaction")
        end

        it "formats grouped data with single result query emphasis" do
          data = [
            {
              group: ["Food", "Groceries"],
              sum: { amount: "$500.00" },
              count: 15
            }
          ]

          requirements = {
            limit: 1,
            sorting: {
              field: "amount",
              direction: "desc"
            }
          }

          result = operation.send(:format_spending_data, data, requirements: requirements)
          expect(result).to include("BIGGEST/LARGEST RESULT")
        end

        it "handles date group formatting" do
          date = Date.new(2024, 1, 15)
          data = [
            {
              group: [date],
              group_fields: ["month"],
              sum: { amount: "$500.00" },
              count: 15
            }
          ]

          result = operation.send(:format_spending_data, data, requirements: {})
          expect(result).to include("January 2024")
        end

        it "handles max, min, and average metrics" do
          data = [
            {
              group: ["Food"],
              max: { amount: "$500.00" },
              count: 15
            }
          ]

          result = operation.send(:format_spending_data, data, requirements: {})
          expect(result).to include("$500.00")
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

          result = operation.send(:format_spending_data, data, requirements: {})
          expect(result).to include("2024-01-15: Coffee - $5.00 (Food)")
        end

        it "formats individual transaction with single result query emphasis" do
          data = [
            {
              date: "2024-01-15",
              description: "Coffee",
              amount: "$5.00",
              category: "Food"
            }
          ]

          requirements = {
            limit: 1,
            sorting: {
              field: "amount",
              direction: "desc"
            }
          }

          result = operation.send(:format_spending_data, data, requirements: requirements)
          expect(result).to include("BIGGEST/LARGEST TRANSACTION")
        end

        it "handles missing fields gracefully" do
          data = [
            {
              date: nil,
              description: nil,
              amount: nil,
              category: nil
            }
          ]

          result = operation.send(:format_spending_data, data, requirements: {})
          expect(result).to include("Unknown date")
          expect(result).to include("No description")
          expect(result).to include("N/A")
          expect(result).to include("Uncategorized")
        end
      end

      context "when data is nil or empty" do
        it "returns no data message for nil data" do
          result = operation.send(:format_spending_data, nil, requirements: {})
          expect(result).to eq("No data found.")
        end

        it "returns no data message for empty data" do
          result = operation.send(:format_spending_data, [], requirements: {})
          expect(result).to eq("No data found.")
        end
      end
    end

    describe "#format_trend_data" do
      it "formats trend data correctly" do
        data = [
          { period: "January", amount: "$1000" },
          { period: "February", amount: "$1200" }
        ]

        result = operation.send(:format_trend_data, data, requirements: {})
        expect(result).to eq("January: $1000\nFebruary: $1200")
      end

      it "handles missing fields gracefully" do
        data = [
          { period: nil, amount: nil }
        ]

        result = operation.send(:format_trend_data, data, requirements: {})
        expect(result).to include("Unknown period: N/A")
      end

      context "when data is nil or empty" do
        it "returns no data message for nil data" do
          result = operation.send(:format_trend_data, nil, requirements: {})
          expect(result).to eq("No trend data found.")
        end

        it "returns no data message for empty data" do
          result = operation.send(:format_trend_data, [], requirements: {})
          expect(result).to eq("No trend data found.")
        end
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

        result = operation.send(:format_transaction_data, data, requirements: {})
        expect(result).to eq("2024-01-15: Coffee - $5.00 (Food) [expense]")
      end

      it "formats transaction data with single result query emphasis" do
        data = [
          {
            date: "2024-01-15",
            description: "Coffee",
            amount: "$5.00",
            category: "Food",
            type: "expense"
          }
        ]

        requirements = {
          limit: 1,
          sorting: {
            field: "amount",
            direction: "desc"
          }
        }

        result = operation.send(:format_transaction_data, data, requirements: requirements)
        expect(result).to include("BIGGEST/LARGEST TRANSACTION")
      end

      it "handles missing fields gracefully" do
        data = [
          {
            date: nil,
            description: nil,
            amount: nil,
            category: nil,
            type: nil
          }
        ]

        result = operation.send(:format_transaction_data, data, requirements: {})
        expect(result).to include("Unknown date")
        expect(result).to include("No description")
        expect(result).to include("N/A")
        expect(result).to include("Uncategorized")
        expect(result).to include("Unknown")
      end

      context "when data is nil or empty" do
        it "returns no data message for nil data" do
          result = operation.send(:format_transaction_data, nil, requirements: {})
          expect(result).to eq("No transaction data found.")
        end

        it "returns no data message for empty data" do
          result = operation.send(:format_transaction_data, [], requirements: {})
          expect(result).to eq("No transaction data found.")
        end
      end
    end

    describe "#normalize_keys" do
      it "converts string keys to symbols in array of hashes" do
        data = [
          { "date" => "2024-01-15", "amount" => "$100" },
          { "date" => "2024-01-16", "amount" => "$200" }
        ]

        result = operation.send(:normalize_keys, data)
        expect(result.first).to have_key(:date)
        expect(result.first).to have_key(:amount)
        expect(result.first).not_to have_key("date")
      end

      it "converts string keys to symbols in hash" do
        data = {
          "date" => "2024-01-15",
          "amount" => "$100",
          "nested" => {
            "key" => "value"
          }
        }

        result = operation.send(:normalize_keys, data)
        expect(result).to have_key(:date)
        expect(result).to have_key(:amount)
        expect(result[:nested]).to have_key(:key)
      end

      it "returns data as-is when not array or hash" do
        data = "string data"
        result = operation.send(:normalize_keys, data)
        expect(result).to eq("string data")
      end

      it "handles nested structures" do
        data = [
          {
            "group" => ["Food"],
            "sum" => {
              "amount" => "$100"
            }
          }
        ]

        result = operation.send(:normalize_keys, data)
        expect(result.first).to have_key(:group)
        expect(result.first[:sum]).to have_key(:amount)
      end
    end
  end
end
