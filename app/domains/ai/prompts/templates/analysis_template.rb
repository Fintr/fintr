# frozen_string_literal: true

module Ai
  module Prompts
    module Templates
      # Template for query analysis prompts
      class AnalysisTemplate
        def initialize(space_id:)
          @space_id = space_id
        end

        def render(
          query:,
          context: nil
        )
          prompt = ""
          prompt += format_context(context) if context.present?
          prompt += instructions
          prompt += category_list
          prompt += rules
          prompt += examples
          prompt += query_section(query)
          prompt
        end

        private

        def format_context(context)
          "Previous conversation context:\n#{context}\n\n"
        end

        def instructions
          <<~INSTRUCTIONS
            You are a financial query analyzer. Analyze the user's query and return a JSON response with exactly these fields:

          INSTRUCTIONS
        end

        def category_list
          categories = fetch_categories
          return "" if categories.empty?

          <<~CATEGORIES
            AVAILABLE CATEGORIES:
            #{categories.map { |c| "- #{c}" }.join("\n")}

          CATEGORIES
        end

        def rules
          <<~RULES
            RULES:
            1. query_type: "spending_analysis" | "income_analysis" | "transaction_search" | "trend_analysis"
            2. data_sources: ["transactions", "accounts", "categories"]
            3. aggregations.group_by: ["category", "account", "month", "week"]
            4. filters.transaction_type: ["expense", "income"]
            5. Max 6 items for charts
            6. Use limit: 1 for "biggest/largest/top"
            7. Use limit: 12 for monthly breakdowns

          RULES
        end

        def examples
          <<~EXAMPLES
            EXAMPLES:
            Query: "What's my biggest expense?"
            {"query_type":"transaction_search","filters":{"transaction_type":["expense"]},"sorting":{"field":"amount","direction":"desc"},"limit":1}

            Query: "Show spending by category this month"
            {"query_type":"spending_analysis","filters":{"transaction_type":["expense"]},"time_range":{"period":"this_month"},"aggregations":{"group_by":["category"],"metrics":["sum"]},"limit":6}

          EXAMPLES
        end

        def query_section(query)
          "Query: #{query}"
        end

        def fetch_categories
          space = Spaces::Space.find_by(id: @space_id)
          return [] unless space

          space.expense_categories.pluck(:name)
        rescue StandardError
          []
        end
      end
    end
  end
end
