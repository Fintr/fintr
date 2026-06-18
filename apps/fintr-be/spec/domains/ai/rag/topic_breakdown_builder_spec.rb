# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Rag::TopicBreakdownBuilder do
  describe ".label_for" do
    it "uses the transaction description, not subcategory" do
      transaction = build(
        :expense_transaction,
        description: "Starbucks",
        subcategory: build(:category, :subcategory, name: "Coffee"),
      )

      expect(described_class.label_for(transaction)).to eq("Starbucks")
    end

    it "titleizes descriptions and keeps dotted merchant names intact" do
      expect(described_class.display_label("J.Co")).to eq("J.Co")
      expect(described_class.display_label("coffee bean and tea leaf")).to eq("Coffee Bean And Tea Leaf")
    end

    it "groups case-insensitive descriptions together" do
      rows = described_class.build(
        [
          { description: "Starbucks", amount_cents: 225_00 },
          { description: "starbucks", amount_cents: 500_00 },
        ],
      )

      expect(rows.size).to eq(1)
      expect(rows.first[:label]).to eq("Starbucks")
      expect(rows.first[:total]).to eq("₱725.00")
      expect(rows.first[:count]).to eq(2)
    end

    it "merges descriptions when one is a word-boundary prefix of another" do
      rows = described_class.build(
        [
          { description: "Starbucks", amount_cents: 1_395_00 },
          { description: "Starbucks Coffee", amount_cents: 1_885_00 },
        ],
      )

      expect(rows.size).to eq(1)
      expect(rows.first[:label]).to eq("Starbucks")
      expect(rows.first[:total]).to eq("₱3,280.00")
      expect(rows.first[:count]).to eq(2)
    end

    it "does not merge unrelated merchants that share a generic prefix" do
      rows = described_class.build(
        [
          { description: "Coffee Mate", amount_cents: 112_95 },
          { description: "Coffee Maker", amount_cents: 1_034_10 },
        ],
      )

      expect(rows.map { |row| row[:label] }).to contain_exactly("Coffee Mate", "Coffee Maker")
    end
  end

  describe ".build" do
    it "groups transactions and collapses long tails into Others" do
      rows = described_class.build(
        [
          { description: "Vendor A", amount_cents: 500_00 },
          { description: "Vendor A", amount_cents: 225_00 },
          { description: "Vendor B", amount_cents: 480_00 },
          { description: "Vendor C", amount_cents: 99_00 },
        ],
        max_groups: 2,
      )

      expect(rows.map { |row| row[:label] }).to eq(["Vendor A", "Others"])
      expect(rows.first[:total]).to eq("₱725.00")
      expect(rows.first[:count]).to eq(2)
    end

    it "keeps at most ten merchants plus Others by default" do
      rows = described_class.build(
        (1..12).map do |index|
          { description: "Merchant #{index}", amount_cents: (13 - index) * 100_00 }
        end,
      )

      expect(rows.map { |row| row[:label] }).to eq(
        (1..10).map { |index| "Merchant #{index}" } + ["Others"],
      )
      expect(rows.last[:count]).to eq(2)
    end
  end
end
