# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Rag::Agent::RetrievalCollector do
  subject(:collector) { described_class.new }

  describe "#record_tool_call" do
    it "stores arguments and result in the tool call trail" do
      collector.record_tool_call(
        name: "search_transactions",
        arguments: { query: "groceries" },
        result: "No results for: groceries",
      )

      expect(collector.tool_call_trail.length).to eq(1)
      expect(collector.tool_call_trail.first).to include(
        name: "search_transactions",
        arguments: { "query" => "groceries" },
        result: "No results for: groceries",
        result_truncated: false,
      )
    end

    it "adds a step with the tool result" do
      collector.record_tool_call(
        name: "query_financial_data",
        arguments: { query_type: "spending_analysis", period: "this_month" },
        result: "Results for spending_analysis (this_month):\n- Food: $10",
      )

      expect(collector.steps.length).to eq(1)
      expect(collector.steps.first[:kind]).to eq("query_financial_data")
      expect(collector.steps.first[:result]).to include("Food: $10")
    end
  end
end
