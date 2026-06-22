# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Rag::Agent::ResponseFallbackBuilder do
  describe ".build" do
    it "returns existing content when it already includes a breakdown and matching totals" do
      tool_calls = [
        {
          name: "query_financial_data",
          arguments: { search_term: "coffee", period: "this_year" },
          result: <<~TEXT.strip
            Results for spending_analysis (this_year):
            Total: ₱8,554.00 across 42 transactions
            Breakdown:
            - Starbucks: ₱3,000.00 (10 transactions)
            - Others: ₱5,554.00 (32 transactions)
          TEXT
        }
      ]
      detailed_content = <<~TEXT.strip
        For this year, you had 42 matching purchases totaling ₱8,554.00.

        Breakdown:
        - Starbucks: ₱3,000.00 (10 transactions)
        - Others: ₱5,554.00 (32 transactions)
      TEXT

      result = described_class.build(
        content: detailed_content,
        tool_calls: tool_calls,
      )

      expect(result).to eq(detailed_content)
    end

    it "replaces a one-line model answer with a breakdown from spending_analysis" do
      result = described_class.build(
        content: "You spent ₱8,554.00 on coffee this year.",
        tool_calls: [
          {
            name: "query_financial_data",
            arguments: { search_term: "coffee", period: "this_year" },
            result: <<~TEXT.strip
              Results for spending_analysis (this_year):
              Total: ₱8,554.00 across 42 transactions
              Breakdown:
              - Starbucks: ₱3,000.00 (10 transactions)
              - Others: ₱5,554.00 (32 transactions)
            TEXT
          }
        ],
      )

      expect(result).to include("42 matching purchases")
      expect(result).to include("₱8,554.00")
      expect(result).to include("Breakdown:")
      expect(result).to include("- Starbucks: ₱3,000.00 (10 transactions)")
      expect(result).to include("- Others: ₱5,554.00 (32 transactions)")
    end

    it "builds a breakdown from transaction_search results when the model answer is too thin" do
      result = described_class.build(
        content: "I found 9 transactions for cigarettes last year, totaling ₱6,771.00.",
        tool_calls: [
          {
            name: "query_financial_data",
            arguments: {
              search_term: "cigarettes",
              period: "last_year",
              query_type: "transaction_search"
            },
            result: <<~TEXT.strip
              Results for transaction_search (last_year):
              - 2025-12-10 00:00:00 UTC: Alfonso coke cigarettes — ₱1,357.00 (Food & Groceries) [txn:abc]
              - 2025-11-08 00:00:00 UTC: Cigarettes coke mismo — ₱1,208.00 (Food & Groceries) [txn:def]
              - 2025-12-07 00:00:00 UTC: 7-Eleven cigarettes — ₱1,117.00 (Food & Groceries) [txn:ghi]
              - 2025-11-16 00:00:00 UTC: Cigarettes — ₱1,020.00 (Food & Groceries) [txn:jkl]
              - 2025-09-21 00:00:00 UTC: Cigarettes — ₱850.00 (Food & Groceries) [txn:mno]
            TEXT
          }
        ],
      )

      expect(result).to include("5 matching purchases")
      expect(result).to include("₱5,552.00")
      expect(result).to include("Breakdown:")
      expect(result).to include("Cigarettes")
    end

    it "summarizes query_financial_data totals when content is blank" do
      result = described_class.build(
        content: "",
        tool_calls: [
          {
            name: "query_financial_data",
            arguments: { search_term: "coffee", period: "this_year" },
            result: <<~TEXT.strip
              Results for spending_analysis (this_year):
              Total: ₱8,554.00 across 42 transactions
              Breakdown:
              - Starbucks: ₱3,000.00 (10 transactions)
            TEXT
          }
        ],
      )

      expect(result).to include("₱8,554.00")
      expect(result).to include("42")
      expect(result).to include("this year")
      expect(result).to include("Breakdown:")
    end

    it "returns the default message when there are no usable tool results" do
      result = described_class.build(
        content: "",
        tool_calls: [],
      )

      expect(result).to eq(described_class::DEFAULT_MESSAGE)
    end
  end
end
