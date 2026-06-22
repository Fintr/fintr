# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Rag::QueryBuilder do
  let(:space) { create(:space) }
  let(:category) { create(:category, :expense, space: space, name: "Dine Out & Entertainment") }
  let(:account) { create(:account, space: space) }
  let(:resolver) { instance_double(Ai::Rag::SemanticTransactionResolver) }

  let(:analysis) do
    Ai::Rag::AnalysisResult.new(
      query_type: "spending_analysis",
      data_sources: ["transactions"],
      aggregations: {},
      filters: {
        transaction_type: ["expense"],
        search_term: "dining"
      },
      time_range: { period: "last_month" },
      sorting: { field: "amount", direction: "desc" },
      limit: 10,
      chart_suggestion: { should_include_chart: false },
      space_id: space.id,
    )
  end

  describe "#for_spending" do
    before do
      allow(Ai::Rag::SemanticTransactionResolver).to receive(:new).and_return(resolver)
    end

    it "unions text matches with full vector resolution for topic searches" do
    text_match = create(
      :expense_transaction,
      space: space,
      account: account,
      category: category,
      description: "Fine dining experience",
      amount_cents: 1_000_00,
      date: Date.current.last_month,
    )
    allow(resolver).to receive(:resolve).and_return(%w[semantic-txn-1 semantic-txn-2])

    query = described_class.new.for_spending(analysis)
    ids = query.pluck(:id)

    expect(resolver).to have_received(:resolve).with(
      hash_including(
        query: "dining",
        space_id: space.id,
        limit: Ai::Rag::SemanticTransactionResolver::AGGREGATE_LIMIT,
        candidate_limit: Ai::Rag::SemanticTransactionResolver::AGGREGATE_CANDIDATE_LIMIT,
      ),
    )
    expect(ids).to include(text_match.id)
    end

    it "returns none when text and vector both miss" do
      allow(resolver).to receive(:resolve).and_return([])

      query = described_class.new.for_spending(analysis)
      expect(query).to be_empty
    end
  end
end
