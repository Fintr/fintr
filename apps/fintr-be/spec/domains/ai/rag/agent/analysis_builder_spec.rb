# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Rag::Agent::AnalysisBuilder do
  describe ".build" do
    it "builds a spending analysis for the space" do
      result = described_class.build(
        space_id: "space-1",
        query_type: "spending_analysis",
        period: "this_month",
        group_by: "category",
      )

      expect(result.space_id).to eq("space-1")
      expect(result.query_type).to eq("spending_analysis")
      expect(result.time_range[:period]).to eq("this_month")
      expect(result.aggregations[:group_by]).to eq(["category"])
      expect(result.filters[:transaction_type]).to eq(["expense"])
    end

    it "includes search_term in filters" do
      result = described_class.build(
        space_id: "space-1",
        query_type: "spending_analysis",
        period: "this_year",
        search_term: "coffee",
      )

      expect(result.filters[:search_term]).to eq("coffee")
    end

    it "forces income transaction type for income analysis" do
      result = described_class.build(
        space_id: "space-1",
        query_type: "income_analysis",
        period: "last_month",
      )

      expect(result.query_type).to eq("income_analysis")
      expect(result.filters[:transaction_type]).to eq(["income"])
    end
  end
end
