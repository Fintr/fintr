# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Rag::TopicFilter do
  let(:space) { create(:space) }
  let(:parent_category) { create(:category, :expense, space: space, name: "Dine Out & Entertainment") }
  let(:subcategory) { create(:category, :subcategory, space: space, parent: parent_category, name: "Coffee") }
  let(:account) { create(:account, space: space) }

  let!(:subcategory_transaction) do
    create(
      :expense_transaction,
      space: space,
      account: account,
      category: parent_category,
      subcategory: subcategory,
      description: "Morning latte",
      date: Date.current,
    )
  end

  let!(:description_transaction) do
    create(
      :expense_transaction,
      space: space,
      account: account,
      category: parent_category,
      subcategory: nil,
      description: "Starbucks Coffee",
      date: Date.current,
    )
  end

  describe ".apply" do
    it "matches transactions by subcategory name" do
      query = described_class.join_tables(space.transactions)
      query = described_class.apply(query, terms: ["Coffee"])

      expect(query).to contain_exactly(subcategory_transaction, description_transaction)
    end

    it "matches transactions by description when subcategory is absent" do
      query = described_class.join_tables(space.transactions)
      query = described_class.apply(query, terms: ["Starbucks"])

      expect(query).to contain_exactly(description_transaction)
    end

    it "does not match unrelated transactions" do
      query = described_class.join_tables(space.transactions)
      query = described_class.apply(query, terms: ["Transport"])

      expect(query).to be_empty
    end
  end

  describe ".apply_to_embeddings" do
    let!(:subcategory_embedding) do
      create(
        :ai_rag_embedding,
        space: space,
        embeddable: subcategory_transaction,
        content: "Morning latte expense",
        metadata: {
          category: parent_category.name,
          subcategory: subcategory.name,
        },
      )
    end

    let!(:description_embedding) do
      create(
        :ai_rag_embedding,
        space: space,
        embeddable: description_transaction,
        content: "Starbucks Coffee expense",
        metadata: {
          category: parent_category.name,
        },
      )
    end

    it "matches embeddings by content and metadata" do
      scope = Ai::RagEmbedding.for_space(space.id)
      results = described_class.apply_to_embeddings(scope, terms: ["coffee"])

      expect(results).to contain_exactly(subcategory_embedding, description_embedding)
    end
  end
end
