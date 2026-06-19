# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Rag::InteractionMetadataBuilder do
  describe ".for_agentic" do
    it "includes tool call audit trail" do
      result = {
        model: "google/gemini-2.5-flash-lite",
        provider: "openrouter",
        searched: true,
        steps: [{ kind: "search_transactions", label: "Searching: food" }],
        tool_calls: [
          {
            name: "search_transactions",
            arguments: { query: "food" },
            result: "No results",
            result_truncated: false
          }
        ],
        reasoning_notes: ["Checking food spending"],
        cited_embedding_ids: []
      }

      metadata = described_class.for_agentic(result)

      expect(metadata[:agentic]).to be(true)
      expect(metadata[:tool_calls]).to eq(result[:tool_calls])
      expect(metadata[:reasoning_notes]).to eq(["Checking food spending"])
    end
  end

  describe ".audit_prompt_for_agentic" do
    it "formats tool calls for the enhanced_prompt field" do
      prompt = described_class.audit_prompt_for_agentic(
        tool_calls: [
          {
            name: "search_transactions",
            arguments: { query: "food" },
            result: "No results",
            result_truncated: false
          }
        ],
      )

      expect(prompt).to include("Tool call 1: search_transactions")
      expect(prompt).to include('"query":"food"')
      expect(prompt).to include("No results")
    end
  end
end
