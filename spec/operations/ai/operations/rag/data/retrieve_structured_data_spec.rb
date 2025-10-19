# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Operations::Rag::Data::RetrieveStructuredData, type: :operation do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let!(:space_user) { create(:space_user, user: user, space: space) }
  let(:account) { create(:account, space: space) }
  let(:category) { create(:category, space: space) }
  let(:expense_transaction) { create(:expense_transaction, space: space, account: account, category: category, amount: 100.0) }
  let(:income_transaction) { create(:income_transaction, space: space, account: account, category: category, amount: 200.0) }

  let(:params) do
    {
      space_id: space.id.to_s,
      data_requirements: {
        query_type: "spending_analysis",
        filters: {},
        time_range: { period: "this_month" }
      }
    }
  end

  let(:fresh_params) do
    {
      space_id: space.id.to_s,
      data_requirements: {
        query_type: "spending_analysis",
        filters: {},
        time_range: { period: "this_month" }
      }
    }
  end

  describe "Contract" do
    it "succeeds with valid parameters" do
      result = operation.validate(params: fresh_params)
      expect(result).to be_success
    end

    it "fails without space_id" do
      invalid_params = {
        data_requirements: {
          query_type: "spending_analysis",
          filters: {},
          time_range: { period: "this_month" }
        }
      }
      result = operation.validate(params: invalid_params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:space_id)
    end

    it "fails without data_requirements" do
      invalid_params = {
        space_id: space.id.to_s
      }
      result = operation.validate(params: invalid_params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:data_requirements)
    end

    it "fails with invalid space_id type" do
      invalid_params = {
        space_id: 123,
        data_requirements: {
          query_type: "spending_analysis",
          filters: {},
          time_range: { period: "this_month" }
        }
      }
      result = operation.validate(params: invalid_params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:space_id)
    end

    it "fails with invalid data_requirements type" do
      invalid_params = {
        space_id: space.id.to_s,
        data_requirements: "invalid"
      }
      result = operation.validate(params: invalid_params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:data_requirements)
    end
  end

  describe "#call" do
    context "when all steps succeed" do
      it "successfully retrieves and formats structured data" do
        result = operation.call(params)
        expect(result).to be_success
        expect(result.value!).to include(
          query_type: "spending_analysis",
          data_summary: kind_of(String),
          raw_data: kind_of(Array),
          metadata: kind_of(Hash)
        )
      end

      it "includes correct metadata" do
        result = operation.call(params)
        metadata = result.value![:metadata]

        expect(metadata).to include(
          total_records: kind_of(Integer),
          aggregation_applied: false,
          time_range: { period: "this_month" },
          filters_applied: {}
        )
      end
    end

    context "when validate fails" do
      let(:invalid_params) { { space_id: nil, data_requirements: {} } }

      it "returns a failure" do
        result = operation.call(invalid_params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:space_id)
      end
    end

    context "when retrieve_structured_data fails" do
      before do
        # Mock the space lookup to fail
        allow(Spaces::Space).to receive(:find).and_raise(StandardError.new("Database connection failed"))
      end

      it "returns a failure" do
        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:data_retrieval_error)
      end
    end

    context "when format_data_for_ai fails" do
      before do
        # Create a transaction that will be retrieved and cause Money.new to be called
        create(:expense_transaction, space: space, account: account, category: category, amount: 100.0)
        # Mock Money class to cause formatting to fail
        allow(Money).to receive(:new).and_raise(StandardError.new("Money formatting failed"))
      end

      it "returns a failure" do
        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:data_retrieval_error)
      end
    end
  end

  describe "private methods" do
    describe "#retrieve_structured_data" do
      context "with spending_analysis query type" do
        let(:spending_params) do
          {
            space_id: space.id,
            data_requirements: {
              query_type: "spending_analysis",
              filters: {},
              time_range: { period: "this_month" }
            }
          }
        end

        it "delegates to retrieve_spending_data" do
          result = operation.send(:retrieve_structured_data, params: spending_params)
          expect(result).to be_success
        end
      end

      context "with income_analysis query type" do
        let(:income_params) do
          {
            space_id: space.id,
            data_requirements: {
              query_type: "income_analysis",
              filters: {},
              time_range: { period: "this_month" }
            }
          }
        end

        it "delegates to retrieve_income_data" do
          result = operation.send(:retrieve_structured_data, params: income_params)
          expect(result).to be_success
        end
      end

      context "with trend_analysis query type" do
        let(:trend_params) do
          {
            space_id: space.id,
            data_requirements: {
              query_type: "trend_analysis",
              filters: {},
              time_range: { period: "this_month" }
            }
          }
        end

        it "delegates to retrieve_trend_data" do
          result = operation.send(:retrieve_structured_data, params: trend_params)
          expect(result).to be_success
        end
      end

      context "with transaction_search query type" do
        let(:search_params) do
          {
            space_id: space.id,
            data_requirements: {
              query_type: "transaction_search",
              filters: {},
              time_range: { period: "this_month" }
            }
          }
        end

        it "delegates to retrieve_transaction_data" do
          result = operation.send(:retrieve_structured_data, params: search_params)
          expect(result).to be_success
        end
      end

      context "with unknown query type" do
        let(:unknown_params) do
          {
            space_id: space.id,
            data_requirements: {
              query_type: "unknown_type",
              filters: {},
              time_range: { period: "this_month" }
            }
          }
        end

        it "delegates to retrieve_general_financial_data" do
          result = operation.send(:retrieve_structured_data, params: unknown_params)
          expect(result).to be_success
          expect(result.value!).to be_an(Array)
        end
      end
    end

    describe "#retrieve_spending_data" do
      let(:spending_params) do
        {
          space_id: space.id,
          data_requirements: {
            query_type: "spending_analysis",
            filters: {},
            time_range: { period: "this_month" }
          }
        }
      end

      context "without aggregations" do
        it "retrieves and serializes transactions" do
          result = operation.send(:retrieve_spending_data, space_id: space.id, requirements: spending_params[:data_requirements])
          expect(result).to be_success
          expect(result.value!).to be_an(Array)
        end
      end

      context "with aggregations" do
        let(:aggregated_params) do
          {
            space_id: space.id,
            data_requirements: {
              query_type: "spending_analysis",
              filters: {},
              time_range: { period: "this_month" },
              aggregations: {
                group_by: ["category"],
                metrics: ["sum", "count"]
              }
            }
          }
        end

        it "applies grouping and returns aggregated data" do
          result = operation.send(:retrieve_spending_data, space_id: space.id, requirements: aggregated_params[:data_requirements])
          expect(result).to be_success
          expect(result.value!).to be_an(Array)
        end
      end

      context "when an error occurs" do
        before do
          allow(Spaces::Space).to receive(:find).and_raise(StandardError.new("Database error"))
        end

        it "returns a failure with error message" do
          result = operation.send(:retrieve_spending_data, space_id: space.id, requirements: spending_params[:data_requirements])
          expect(result).to be_failure
          expect(result.failure).to have_key(:data_retrieval_error)
          expect(result.failure[:data_retrieval_error]).to include("Failed to retrieve spending data")
        end
      end
    end

    describe "#retrieve_income_data" do
      let(:income_params) do
        {
          space_id: space.id,
          data_requirements: {
            query_type: "income_analysis",
            filters: {},
            time_range: { period: "this_month" }
          }
        }
      end

      it "calls retrieve_spending_data with income filters" do
        result = operation.send(:retrieve_income_data, space_id: space.id, requirements: income_params[:data_requirements])
        expect(result).to be_success
      end
    end

    describe "#retrieve_trend_data" do
      let(:trend_params) do
        {
          space_id: space.id,
          data_requirements: {
            query_type: "trend_analysis",
            filters: {},
            time_range: { period: "this_month" }
          }
        }
      end

      it "retrieves trend data grouped by time periods" do
        result = operation.send(:retrieve_trend_data, space_id: space.id, requirements: trend_params[:data_requirements])
        expect(result).to be_success
        expect(result.value!).to be_an(Array)
      end

      context "when an error occurs" do
        before do
          allow(Spaces::Space).to receive(:find).and_raise(StandardError.new("Database error"))
        end

        it "returns a failure with error message" do
          result = operation.send(:retrieve_trend_data, space_id: space.id, requirements: trend_params[:data_requirements])
          expect(result).to be_failure
          expect(result.failure).to have_key(:data_retrieval_error)
          expect(result.failure[:data_retrieval_error]).to include("Failed to retrieve trend data")
        end
      end
    end

    describe "#retrieve_transaction_data" do
      let(:search_params) do
        {
          space_id: space.id,
          data_requirements: {
            query_type: "transaction_search",
            filters: {},
            time_range: { period: "this_month" }
          }
        }
      end

      it "retrieves and serializes transactions" do
        result = operation.send(:retrieve_transaction_data, space_id: space.id, requirements: search_params[:data_requirements])
        expect(result).to be_success
        expect(result.value!).to be_an(Array)
      end

      context "when an error occurs" do
        before do
          allow(Spaces::Space).to receive(:find).and_raise(StandardError.new("Database error"))
        end

        it "returns a failure with error message" do
          result = operation.send(:retrieve_transaction_data, space_id: space.id, requirements: search_params[:data_requirements])
          expect(result).to be_failure
          expect(result.failure).to have_key(:data_retrieval_error)
          expect(result.failure[:data_retrieval_error]).to include("Failed to retrieve transaction data")
        end
      end
    end

    describe "#build_transaction_query" do
      let(:query_params) do
        {
          space_id: space.id,
          data_requirements: {
            query_type: "spending_analysis",
            filters: {},
            time_range: { period: "this_month" }
          }
        }
      end

      it "builds a transaction query with filters applied" do
        result = operation.send(:build_transaction_query, space_id: space.id, requirements: query_params[:data_requirements])
        expect(result).to be_success
        expect(result.value!).to be_a(ActiveRecord::Relation)
      end

      context "when space is not found" do
        it "returns a failure" do
          result = operation.send(:build_transaction_query, space_id: "non-existent", requirements: query_params[:data_requirements])
          expect(result).to be_failure
          expect(result.failure).to have_key(:data_retrieval_error)
        end
      end

      context "when an error occurs" do
        before do
          allow(Spaces::Space).to receive(:find).and_raise(StandardError.new("Database error"))
        end

        it "returns a failure with error message" do
          result = operation.send(:build_transaction_query, space_id: space.id, requirements: query_params[:data_requirements])
          expect(result).to be_failure
          expect(result.failure).to have_key(:data_retrieval_error)
          expect(result.failure[:data_retrieval_error]).to include("Failed to build transaction query")
        end
      end
    end

    describe "#apply_transaction_type_filter" do
      let(:query) { space.transactions }

      it "filters by transaction types and returns original query when no filter" do
        # Test expense filter
        result = operation.send(:apply_transaction_type_filter, query, { transaction_type: ["expense"] })
        expect(result).to be_a(ActiveRecord::Relation)

        # Test income filter
        result = operation.send(:apply_transaction_type_filter, query, { transaction_type: ["income"] })
        expect(result).to be_a(ActiveRecord::Relation)

        # Test no filter
        result = operation.send(:apply_transaction_type_filter, query, {})
        expect(result).to eq(query)
      end
    end

    describe "#apply_category_filter" do
      let(:query) { space.transactions }

      it "filters by category names and returns original query when no filter" do
        # Test with filter
        result = operation.send(:apply_category_filter, query, { categories: ["Food"] })
        expect(result).to be_a(ActiveRecord::Relation)

        # Test without filter
        result = operation.send(:apply_category_filter, query, {})
        expect(result).to eq(query)
      end
    end

    describe "#apply_account_filter" do
      let(:query) { space.transactions }

      it "filters by account names and returns original query when no filter" do
        # Test with filter
        result = operation.send(:apply_account_filter, query, { accounts: ["Cash"] })
        expect(result).to be_a(ActiveRecord::Relation)

        # Test without filter
        result = operation.send(:apply_account_filter, query, {})
        expect(result).to eq(query)
      end
    end

    describe "#apply_description_filter" do
      let(:query) { space.transactions }

      it "filters by description keywords and returns original query when no filter" do
        # Test with filter
        result = operation.send(:apply_description_filter, query, { descriptions: ["grocery"] })
        expect(result).to be_a(ActiveRecord::Relation)

        # Test without filter
        result = operation.send(:apply_description_filter, query, {})
        expect(result).to eq(query)
      end
    end

    describe "#apply_amount_filter" do
      let(:query) { space.transactions }

      it "filters by amount ranges and returns original query when no filter" do
        # Test minimum amount
        result = operation.send(:apply_amount_filter, query, { amount_range: { min: 50 } })
        expect(result).to be_a(ActiveRecord::Relation)

        # Test maximum amount
        result = operation.send(:apply_amount_filter, query, { amount_range: { max: 200 } })
        expect(result).to be_a(ActiveRecord::Relation)

        # Test range
        result = operation.send(:apply_amount_filter, query, { amount_range: { min: 50, max: 200 } })
        expect(result).to be_a(ActiveRecord::Relation)

        # Test no filter
        result = operation.send(:apply_amount_filter, query, {})
        expect(result).to eq(query)
      end
    end

    describe "#apply_time_range_filter" do
      let(:query) { space.transactions }

      it "filters by various time periods and handles edge cases" do
        # Test different periods
        periods = ["this_month", "last_month", "this_week", "last_week", "this_year", "last_year"]
        periods.each do |period|
          result = operation.send(:apply_time_range_filter, query, { period: period })
          expect(result).to be_a(ActiveRecord::Relation)
        end

        # Test custom date range
        result = operation.send(:apply_time_range_filter, query, {
          period: "custom",
          start_date: "2024-01-01",
          end_date: "2024-01-31"
        })
        expect(result).to be_a(ActiveRecord::Relation)

        # Test no filter
        result = operation.send(:apply_time_range_filter, query, {})
        expect(result).to eq(query)

        # Test invalid date
        result = operation.send(:apply_time_range_filter, query, {
          period: "custom",
          start_date: "invalid-date"
        })
        expect(result).to eq(query)
      end
    end

    describe "#apply_grouping" do
      let(:query) { space.transactions }
      let(:group_fields) { ["category"] }
      let(:metrics) { ["sum", "count"] }

      it "applies grouping and returns formatted data" do
        result = operation.send(:apply_grouping, query, group_fields, metrics)
        expect(result).to be_success
        expect(result.value!).to be_an(Array)
      end

      context "when an error occurs" do
        before do
          allow(query).to receive(:joins).and_raise(StandardError.new("Database error"))
        end

        it "returns a failure with error message" do
          result = operation.send(:apply_grouping, query, group_fields, metrics)
          expect(result).to be_failure
          expect(result.failure).to have_key(:data_retrieval_error)
          expect(result.failure[:data_retrieval_error]).to include("Failed to apply grouping")
        end
      end
    end

    describe "#format_grouped_data" do
      let(:result_data) do
        {
          sum: { "Food" => 10000, "Transport" => 5000 },
          count: { "Food" => 2, "Transport" => 1 }
        }
      end
      let(:group_fields) { ["category"] }

      it "formats grouped data correctly" do
        result = operation.send(:format_grouped_data, result_data, group_fields)
        expect(result).to be_success
        expect(result.value!).to be_an(Array)
        expect(result.value!.first).to include(:group, :group_fields, :sum, :count)
      end

      it "handles empty data gracefully" do
        result = operation.send(:format_grouped_data, {}, group_fields)
        expect(result).to be_success
        expect(result.value!).to eq([])
      end

      context "when an error occurs" do
        before do
          allow(result_data[:sum]).to receive(:map).and_raise(StandardError.new("Format error"))
        end

        it "returns a failure with error message" do
          result = operation.send(:format_grouped_data, result_data, group_fields)
          expect(result).to be_failure
          expect(result.failure).to have_key(:data_retrieval_error)
          expect(result.failure[:data_retrieval_error]).to include("Failed to format grouped data")
        end
      end
    end

    describe "#apply_sorting_and_limit" do
      let(:query) { space.transactions }
      let(:requirements) { { sorting: { field: "amount", direction: :desc }, limit: 5 } }

      it "applies sorting and limit with various configurations" do
        # Test with both sorting and limit
        result = operation.send(:apply_sorting_and_limit, query, requirements)
        expect(result).to be_success
        expect(result.value!).to be_a(ActiveRecord::Relation)

        # Test with only limit
        result = operation.send(:apply_sorting_and_limit, query, { limit: 5 })
        expect(result).to be_success
        expect(result.value!).to be_a(ActiveRecord::Relation)

        # Test with only sorting
        result = operation.send(:apply_sorting_and_limit, query, { sorting: { field: "amount" } })
        expect(result).to be_success
        expect(result.value!).to be_a(ActiveRecord::Relation)
      end

      context "when an error occurs" do
        before do
          allow(query).to receive(:order).and_raise(StandardError.new("Database error"))
        end

        it "returns a failure with error message" do
          result = operation.send(:apply_sorting_and_limit, query, requirements)
          expect(result).to be_failure
          expect(result.failure).to have_key(:data_retrieval_error)
          expect(result.failure[:data_retrieval_error]).to include("Failed to apply sorting and limit")
        end
      end
    end

    describe "#determine_time_grouping" do
      it "returns appropriate grouping for different periods and handles edge cases" do
        # Test year period
        result = operation.send(:determine_time_grouping, { period: "this_year" })
        expect(result).to be_success
        expect(result.value!).to eq(:month)

        # Test month period
        result = operation.send(:determine_time_grouping, { period: "this_month" })
        expect(result).to be_success
        expect(result.value!).to eq(:day)

        # Test week period
        result = operation.send(:determine_time_grouping, { period: "this_week" })
        expect(result).to be_success
        expect(result.value!).to eq(:day)

        # Test invalid period
        result = operation.send(:determine_time_grouping, { period: nil })
        expect(result).to be_success
        expect(result.value!).to eq(:day) # Should default to day
      end
    end

    describe "#serialize_transaction" do
      it "serializes transaction correctly" do
        result = operation.send(:serialize_transaction, expense_transaction)
        expect(result).to be_success
        expect(result.value!).to include(
          id: expense_transaction.id,
          amount: kind_of(String),
          amount_cents: expense_transaction.amount_cents,
          description: expense_transaction.description,
          category: category.name,
          account: account.name,
          date: kind_of(String),
          type: "expense"
        )
      end

      context "when an error occurs" do
        before do
          allow(expense_transaction).to receive(:id).and_raise(StandardError.new("Serialization error"))
        end

        it "returns a failure with error message" do
          result = operation.send(:serialize_transaction, expense_transaction)
          expect(result).to be_failure
          expect(result.failure).to have_key(:data_retrieval_error)
          expect(result.failure[:data_retrieval_error]).to include("Failed to serialize transaction")
        end
      end
    end

    describe "#format_data_for_ai" do
      let(:data) { [{ id: 1, amount_cents: 10000 }] }
      let(:requirements) { { query_type: "spending_analysis" } }

      it "formats data for AI consumption" do
        result = operation.send(:format_data_for_ai, data: data, requirements: requirements)
        expect(result).to be_success
        expect(result.value!).to include(
          query_type: "spending_analysis",
          data_summary: kind_of(String),
          raw_data: data,
          metadata: kind_of(Hash)
        )
      end

      context "when an error occurs" do
        before do
          # Mock Money class to cause formatting to fail
          allow(Money).to receive(:new).and_raise(StandardError.new("Money formatting failed"))
        end

        it "returns a failure with error message" do
          result = operation.send(:format_data_for_ai, data: data, requirements: requirements)
          expect(result).to be_failure
          expect(result.failure).to have_key(:data_retrieval_error)
          expect(result.failure[:data_retrieval_error]).to include("Failed to format data for AI")
        end
      end
    end

    describe "#build_data_summary" do
      it "builds appropriate summaries for different data types and handles edge cases" do
        # Test grouped spending data
        data = [{ sum: { amount_cents: 10000 } }]
        requirements = { query_type: "spending_analysis" }
        result = operation.send(:build_data_summary, data, requirements)
        expect(result).to be_success
        expect(result.value!).to include("Found 1 spending categories")

        # Test transaction data
        data = [{ amount_cents: 10000 }]
        result = operation.send(:build_data_summary, data, requirements)
        expect(result).to be_success
        expect(result.value!).to include("Found 1 transactions")

        # Test income data
        data = [{ amount_cents: 20000 }]
        requirements = { query_type: "income_analysis" }
        result = operation.send(:build_data_summary, data, requirements)
        expect(result).to be_success
        expect(result.value!).to include("Found 1 income entries")

        # Test trend data
        data = [{ period: "2024-01" }]
        requirements = { query_type: "trend_analysis" }
        result = operation.send(:build_data_summary, data, requirements)
        expect(result).to be_success
        expect(result.value!).to include("Found trend data across 1 time periods")

        # Test empty data
        data = []
        requirements = { query_type: "spending_analysis" }
        result = operation.send(:build_data_summary, data, requirements)
        expect(result).to be_success
        expect(result.value!).to eq("No data found")
      end

      context "when an error occurs" do
        let(:data) { [{ amount_cents: 10000 }] }
        let(:requirements) { { query_type: "spending_analysis" } }

        before do
          allow(data).to receive(:sum).and_raise(StandardError.new("Summary error"))
        end

        it "returns a failure with error message" do
          result = operation.send(:build_data_summary, data, requirements)
          expect(result).to be_failure
          expect(result.failure).to have_key(:data_retrieval_error)
          expect(result.failure[:data_retrieval_error]).to include("Failed to build data summary")
        end
      end
    end
  end
end
