# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Rag::CategoryFilter do
  let(:space) { create(:space) }
  let(:parent_category) { create(:category, :expense, space: space, name: "Dine Out & Entertainment") }
  let(:subcategory) { create(:category, :subcategory, space: space, parent: parent_category, name: "Coffee") }
  let(:account) { create(:account, space: space) }

  let!(:coffee_transaction) do
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

  describe ".apply_category_names" do
    it "matches transactions by subcategory name" do
      query = space.transactions
      query = described_class.join_category_tables(query)
      query = described_class.apply_category_names(query, category_names: ["Coffee"])

      expect(query).to contain_exactly(coffee_transaction)
    end

    it "does not match unrelated categories" do
      query = space.transactions
      query = described_class.join_category_tables(query)
      query = described_class.apply_category_names(query, category_names: ["Transport"])

      expect(query).to be_empty
    end
  end

  describe ".apply_to_embeddings" do
    let!(:embedding) do
      create(
        :ai_rag_embedding,
        space: space,
        embeddable: coffee_transaction,
        metadata: {
          category: parent_category.name,
          subcategory: subcategory.name,
          account: account.name,
          date: coffee_transaction.date.iso8601
        },
      )
    end

    it "matches embeddings by subcategory metadata" do
      scope = Ai::RagEmbedding.for_space(space.id)
      results = described_class.apply_to_embeddings(scope, category_name: "Coffee")

      expect(results).to contain_exactly(embedding)
    end
  end
end
