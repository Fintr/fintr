# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::CategoryAppearance do
  describe ".resolve" do
    it "returns known defaults for default category names" do
      result = described_class.resolve(
        name: "Food & Groceries",
        category_type: "expense",
      )

      expect(result).to eq(icon: "shopping-cart", color: "#43A047")
    end

    it "uses provided icon and color when valid" do
      result = described_class.resolve(
        name: "Custom",
        category_type: "expense",
        icon: "coffee",
        color: "#abcdef",
      )

      expect(result).to eq(icon: "coffee", color: "#ABCDEF")
    end

    it "falls back to generated defaults for unknown names" do
      result = described_class.resolve(
        name: "My Custom Category",
        category_type: "income",
      )

      expect(result[:icon]).to eq("tag")
      expect(described_class::PALETTE).to include(result[:color])
    end
  end
end
