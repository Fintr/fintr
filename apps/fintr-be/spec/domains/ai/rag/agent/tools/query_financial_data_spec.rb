# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Rag::Agent::Tools::QueryFinancialData do
  let(:space) { create(:space) }
  let(:category) { create(:category, :expense, space: space, name: "Dine Out & Entertainment") }
  let(:account) { create(:account, space: space) }
  let(:collector) { Ai::Rag::Agent::RetrievalCollector.new }

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
  end

  describe "#execute" do
    it "returns aggregate totals for spending analysis" do
      data_retriever = instance_double(Ai::Rag::DataRetriever)
      allow(data_retriever).to receive(:retrieve).and_return(
        [
          {
            aggregate: true,
            total: "₱500.00",
            total_cents: 500_00,
            count: 1,
            transactions: [
              {
                id: "txn-1",
                date: Date.current.to_s,
                description: "Starbucks Coffee",
                amount: "₱500.00",
                category: category.name,
              },
            ],
          },
        ],
      )

      tool = described_class.new(
        space_id: space.id,
        collector: collector,
        data_retriever: data_retriever,
      )

      result = tool.execute(
        query_type: "spending_analysis",
        period: "this_year",
        search_term: "coffee",
      )

      expect(result).to include("Total: ₱500.00 across 1 transactions")
      expect(result).to include("Starbucks Coffee")
    end

    it "includes topic breakdown when provided" do
      data_retriever = instance_double(Ai::Rag::DataRetriever)
      allow(data_retriever).to receive(:retrieve).and_return(
        [
          {
            aggregate: true,
            total: "₱725.00",
            total_cents: 725_00,
            count: 2,
            topic_breakdown: [
              { label: "Vendor A", total: "₱725.00", count: 2, total_cents: 725_00 },
            ],
            transactions: [],
          },
        ],
      )

      tool = described_class.new(
        space_id: space.id,
        collector: collector,
        data_retriever: data_retriever,
      )

      result = tool.execute(
        query_type: "spending_analysis",
        period: "this_year",
        search_term: "vendor",
      )

      expect(result).to include("Breakdown:")
      expect(result).to include("Vendor A: ₱725.00 (2 transactions)")
    end
  end
end
