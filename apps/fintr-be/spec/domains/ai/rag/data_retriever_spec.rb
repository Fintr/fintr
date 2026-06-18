# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Rag::DataRetriever do
  describe "#retrieve" do
    let(:space) { create(:space) }
    let(:category) { create(:category, :expense, space: space, name: "Dine Out & Entertainment") }
    let(:account) { create(:account, space: space) }

    let(:analysis) do
      Ai::Rag::AnalysisResult.new(
        query_type: "spending_analysis",
        data_sources: ["transactions"],
        aggregations: {},
        filters: {
          transaction_type: ["expense"],
          categories: ["coffee"],
        },
        time_range: { period: "this_year" },
        sorting: { field: "amount", direction: "desc" },
        limit: 5,
        chart_suggestion: { should_include_chart: false },
        space_id: space.id,
      )
    end

    before do
      create(
        :expense_transaction,
        space: space,
        account: account,
        category: category,
        description: "Starbucks Coffee",
        amount_cents: 500_00,
        date: Date.current,
      )
      create(
        :expense_transaction,
        space: space,
        account: account,
        category: category,
        description: "Pick up coffee",
        amount_cents: 99_00,
        date: Date.current,
      )
    end

    it "returns aggregate totals for spending analysis without group_by" do
      result = described_class.new.retrieve(analysis)

      expect(result.length).to eq(1)
      expect(result.first[:aggregate]).to be(true)
      expect(result.first[:count]).to eq(2)
      expect(result.first[:total_cents]).to eq(599_00)
      expect(result.first[:transactions].length).to be <= 5
    end

    context "when search_term relies on vector matches" do
      let(:vector_searcher) { instance_double(Ai::Rag::VectorSearcher) }
      let(:resolver) { Ai::Rag::SemanticTransactionResolver.new(vector_searcher: vector_searcher) }
      let(:dine_out_subcategory) do
        create(
          :category,
          :subcategory,
          space: space,
          parent: category,
          name: "Dine out",
        )
      end

      let(:analysis) do
        Ai::Rag::AnalysisResult.new(
          query_type: "spending_analysis",
          data_sources: ["transactions"],
          aggregations: {},
          filters: {
            transaction_type: ["expense"],
            search_term: "dining",
          },
          time_range: { period: "this_year" },
          sorting: { field: "amount", direction: "desc" },
          limit: 5,
          chart_suggestion: { should_include_chart: false },
          space_id: space.id,
        )
      end

      before do
        allow(Ai::Rag::SemanticTransactionResolver).to receive(:new).and_return(resolver)
      end

      it "includes semantically matched dine out rows even when descriptions omit the query word" do
        dine_out_txn = create(
          :expense_transaction,
          space: space,
          account: account,
          category: category,
          subcategory: dine_out_subcategory,
          description: "Lansangan Meals",
          amount_cents: 2_080_00,
          date: Date.current,
        )

        allow(vector_searcher).to receive(:search).and_return(
          [
            {
              embeddable_type: "Transactions::Transaction",
              embeddable_id: dine_out_txn.id,
              distance: 0.537,
              content: "Lansangan Meals expense in Dine Out & Entertainment, Dine out",
              metadata: {
                "category" => category.name,
                "subcategory" => dine_out_subcategory.name,
              },
            },
          ],
        )

        result = described_class.new.retrieve(analysis)

        expect(result.first[:count]).to eq(1)
        expect(result.first[:total_cents]).to eq(2_080_00)
      end
    end
  end
end
