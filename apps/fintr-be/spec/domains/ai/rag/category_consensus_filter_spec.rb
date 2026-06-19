# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Rag::CategoryConsensusFilter do
  def result_for(category:, distance: 0.5, embeddable_id: SecureRandom.uuid)
    {
      embeddable_id: embeddable_id,
      distance: distance,
      metadata: { "category" => category }
    }
  end

  describe ".filter_results" do
    it "keeps only transactions in categories that dominate the top anchors" do
      results = [
        result_for(category: "Dine Out & Entertainment", distance: 0.45, embeddable_id: "dine-1"),
        result_for(category: "Dine Out & Entertainment", distance: 0.46, embeddable_id: "dine-2"),
        result_for(category: "Dine Out & Entertainment", distance: 0.47, embeddable_id: "dine-3"),
        result_for(category: "Pet", distance: 0.55, embeddable_id: "pet-1"),
        result_for(category: "Food & Groceries", distance: 0.58, embeddable_id: "grocery-1")
      ]

      filtered = described_class.filter_results(results)

      expect(filtered.map { |row| row[:embeddable_id] }).to eq(%w[dine-1 dine-2 dine-3])
    end

    it "allows multiple categories when both dominate the anchor window" do
      dine_out = Array.new(5) { |index| result_for(category: "Dine Out & Entertainment", distance: 0.4 + (index * 0.01)) }
      groceries = Array.new(5) { |index| result_for(category: "Food & Groceries", distance: 0.5 + (index * 0.01)) }
      pet = [result_for(category: "Pet", distance: 0.6)]

      filtered = described_class.filter_results(dine_out + groceries + pet)

      categories = filtered.map { |row| row.dig(:metadata, "category") }.uniq
      expect(categories).to contain_exactly("Dine Out & Entertainment", "Food & Groceries")
      expect(categories).not_to include("Pet")
    end
  end
end
