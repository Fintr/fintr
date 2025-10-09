# frozen_string_literal: true

module Ai
  module Operations
    module Rag
      module Analysis
        class AnalyzeQueryIntent < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:query).value(:string)
            required(:space_id).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params = step validate(params:)
          analysis_result = step analyze_query_intent(params:)
          analysis = analysis_result[:parsed_analysis]
          raw_response = analysis_result[:raw_response]

          requirements = step determine_data_requirements(analysis:)

          # Include the raw AI response in the result
          {
            requirements: requirements,
            raw_ai_analysis: raw_response,
            parsed_analysis: analysis
          }
        end

        private

        def analyze_query_intent(params:)
          client = OpenAI::Client.new(access_token: ENV["OPENAI_API_KEY"])

          system_prompt = build_analysis_prompt
          user_query = params[:query]


          response = client.chat(
            parameters: {
              model: "gpt-3.5-turbo",
              messages: [
                { role: "system", content: system_prompt },
                { role: "user", content: user_query }
              ],
              temperature: 0.1,
              max_tokens: 1000
            }
          )

          analysis_text = response.dig("choices", 0, "message", "content")

          parsed_analysis = parse_analysis_response(analysis_text)

          Success({
            parsed_analysis: parsed_analysis,
            raw_response: analysis_text
          })
        rescue StandardError => e
          Failure(analysis_error: "Failed to analyze query intent: #{e.message}")
        end

        def determine_data_requirements(analysis:)
          requirements = {
            query_type: analysis[:query_type],
            data_sources: analysis[:data_sources],
            aggregations: analysis[:aggregations],
            filters: analysis[:filters],
            time_range: analysis[:time_range],
            sorting: analysis[:sorting],
            limit: analysis[:limit]
          }

          Success(requirements)
        end

        def build_analysis_prompt
          current_date = Date.current
          current_year = current_date.year

          <<~PROMPT
            You are a financial data analyst AI. Analyze user queries about personal finance and determine exactly what data is needed to answer them accurately.

            CURRENT DATE CONTEXT:
            - Today is #{current_date.strftime("%B %d, %Y")}
            - Current year: #{current_year}
            - Current month: #{current_date.strftime("%B")}

            IMPORTANT: When users mention months or time periods without specifying a year, assume they mean the MOST RECENT occurrence. For example:
            - "September" or "last September" → September #{current_year - 1} (most recent September)
            - "this September" → September #{current_year} (if we're past September) or September #{current_year} (if we're before September)
            - "last month" → #{current_date.last_month.strftime("%B %Y")}
            - "this month" → #{current_date.strftime("%B %Y")}

            SMART DATE INFERENCE:
            - If user says "September" in #{current_date.strftime("%B")} #{current_year}, they likely mean September #{current_year - 1} (most recent completed September)
            - If user says "September" in January-July #{current_year}, they likely mean September #{current_year - 1} (most recent September)
            - If user says "September" in August-December #{current_year}, they likely mean September #{current_year} (current year's September)
            - Always prioritize the most recent data that makes sense contextually

            For each query, return a JSON response with these fields:

            {
              "query_type": "spending_analysis|income_analysis|budget_analysis|trend_analysis|comparison|balance_inquiry|transaction_search",
              "data_sources": ["transactions", "transfers", "budgets", "accounts", "categories"],
              "aggregations": {
                "group_by": ["category", "account", "description", "month", "week", "day"],
                "metrics": ["sum", "count", "average", "max", "min"]
              },
              "filters": {
                "transaction_type": ["expense", "income", "transfer"],
                "categories": ["specific category names if mentioned"],
                "accounts": ["specific account names if mentioned"],
                "descriptions": ["specific merchant/description keywords if mentioned"],
                "amount_range": {"min": null, "max": null}
              },
              "time_range": {
                "period": "last_month|this_month|last_week|this_week|last_year|this_year|custom",
                "start_date": null,
                "end_date": null
              },
              "sorting": {
                "field": "amount|date|frequency",
                "direction": "desc|asc"
              },
              "limit": 10
            }

            Examples:
            - "What's my biggest spend" → query_type: "spending_analysis", group_by: ["category"], metrics: ["sum", "count"], sorting: {field: "amount", direction: "desc"}, limit: 1
            - "How much did I spend on coffee this month" → query_type: "spending_analysis", filters: {categories: ["coffee"]}, time_range: {period: "this_month"}, metrics: ["sum", "count"]
            - "Show my top 5 merchants" → query_type: "spending_analysis", group_by: ["description"], metrics: ["sum", "count"], sorting: {field: "amount", direction: "desc"}, limit: 5
            - "What's my income for September" → query_type: "income_analysis", time_range: {period: "custom", start_date: "#{current_year - 1}-09-01", end_date: "#{current_year - 1}-09-30"}, metrics: ["sum", "count"] (assuming most recent September)
            - "How much did I spend last month" → query_type: "spending_analysis", time_range: {period: "custom", start_date: "#{current_date.last_month.beginning_of_month.strftime("%Y-%m-%d")}", end_date: "#{current_date.last_month.end_of_month.strftime("%Y-%m-%d")}"}, metrics: ["sum", "count"]}

            DATE LOGIC RULES:
            1. If no year is specified, use the most recent occurrence of that month/period
            2. "this [month]" refers to the current year's month (if we're past it) or upcoming month
            3. "last [month]" refers to the most recent completed occurrence
            4. Always prefer recent data over old data when ambiguous
            5. For income queries, look at the most recent complete month/period

            Return only valid JSON.
          PROMPT
        end

        def parse_analysis_response(response_text)
          # Extract JSON from the response
          json_match = response_text.match(/\{.*\}/m)
          return default_analysis if json_match.nil?

          parsed = JSON.parse(json_match[0], symbolize_names: true)

          # Validate and clean the parsed response
          {
            query_type: parsed[:query_type] || "spending_analysis",
            data_sources: Array(parsed[:data_sources]),
            aggregations: parsed[:aggregations] || {},
            filters: parsed[:filters] || {},
            time_range: parsed[:time_range] || { period: "this_month" },
            sorting: parsed[:sorting] || { field: "amount", direction: "desc" },
            limit: [parsed[:limit] || 10, 50].min # Cap at 50 results
          }
        rescue JSON::ParserError
          default_analysis
        end

        def default_analysis
          current_date = Date.current
          {
            query_type: "spending_analysis",
            data_sources: ["transactions"],
            aggregations: { group_by: ["category"], metrics: ["sum", "count"] },
            filters: { transaction_type: ["expense"] },
            time_range: {
              period: "this_month",
              start_date: current_date.beginning_of_month.strftime("%Y-%m-%d"),
              end_date: current_date.end_of_month.strftime("%Y-%m-%d")
            },
            sorting: { field: "amount", direction: "desc" },
            limit: 10
          }
        end
        end
      end
    end
  end
end
