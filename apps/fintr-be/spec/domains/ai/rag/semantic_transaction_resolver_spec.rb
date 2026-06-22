# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Rag::SemanticTransactionResolver do
  let(:space) { create(:space) }
  let(:vector_searcher) { instance_double(Ai::Rag::VectorSearcher) }
  let(:resolver) { described_class.new(vector_searcher: vector_searcher) }

  it "returns unique transaction ids from vector search results" do
    allow(vector_searcher).to receive(:search).and_return(
      [
        {
          embeddable_type: "Transactions::Transaction",
          embeddable_id: "txn-1",
          distance: 0.4,
          content: "Groceries",
          metadata: { "category" => "Food & Groceries" }
        },
        {
          embeddable_type: "Transactions::Transaction",
          embeddable_id: "txn-2",
          distance: 0.5,
          content: "Market",
          metadata: { "category" => "Food & Groceries" }
        },
        { embeddable_type: "Transactions::Transfer", embeddable_id: "transfer-1", distance: 0.4, content: "Transfer", metadata: {} }
      ],
    )

    ids = resolver.resolve(
      query: "groceries spending",
      space_id: space.id,
      time_range: { period: "this_year" },
      filters: { transaction_type: ["expense"] },
    )

    expect(ids).to eq(%w[txn-1 txn-2])
  end

  it "excludes pet food when dining anchors are dine out transactions" do
    allow(vector_searcher).to receive(:search).and_return(
      [
        {
          embeddable_type: "Transactions::Transaction",
          embeddable_id: "txn-dine-1",
          distance: 0.45,
          metadata: { "category" => "Dine Out & Entertainment" }
        },
        {
          embeddable_type: "Transactions::Transaction",
          embeddable_id: "txn-dine-2",
          distance: 0.46,
          metadata: { "category" => "Dine Out & Entertainment" }
        },
        {
          embeddable_type: "Transactions::Transaction",
          embeddable_id: "txn-dine-3",
          distance: 0.47,
          metadata: { "category" => "Dine Out & Entertainment" }
        },
        {
          embeddable_type: "Transactions::Transaction",
          embeddable_id: "txn-pet-1",
          distance: 0.55,
          metadata: { "category" => "Pet" }
        }
      ],
    )

    ids = resolver.resolve(
      query: "dining",
      space_id: space.id,
      time_range: { period: "last_month" },
      filters: { transaction_type: ["expense"] },
    )

    expect(ids).to eq(%w[txn-dine-1 txn-dine-2 txn-dine-3])
  end

  it "trusts vector threshold for any topic without extra text gates" do
    allow(vector_searcher).to receive(:search).and_return(
      [
        {
          embeddable_type: "Transactions::Transaction",
          embeddable_id: "txn-dine-1",
          distance: 0.537,
          content: "Lansangan Meals expense in Dine Out & Entertainment, Dine out via Cash",
          metadata: {
            "category" => "Dine Out & Entertainment",
            "subcategory" => "Dine out"
          }
        },
        {
          embeddable_type: "Transactions::Transaction",
          embeddable_id: "txn-dine-2",
          distance: 0.61,
          content: "Pancake house expense in Dine Out & Entertainment, Dine out",
          metadata: { "category" => "Dine Out & Entertainment" }
        }
      ],
    )

    ids = resolver.resolve(
      query: "dining",
      space_id: space.id,
      time_range: { period: "last_month" },
      filters: { transaction_type: ["expense"] },
    )

    expect(ids).to eq(%w[txn-dine-1 txn-dine-2])
  end

  it "enriches single-word queries for embedding search" do
    allow(vector_searcher).to receive(:search).and_return([])

    resolver.resolve(
      query: "coffee",
      space_id: space.id,
      filters: {},
    )

    expect(vector_searcher).to have_received(:search).with(
      hash_including(query: "coffee spending"),
    )
  end
end
