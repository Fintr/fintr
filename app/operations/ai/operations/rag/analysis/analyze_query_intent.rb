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
            optional(:openai_conversation_id).maybe(:string)
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

          # Validate and filter categories to ensure only valid ones are used
          validated_analysis = step validate_categories(analysis:, space_id: params[:space_id])

          requirements = step determine_data_requirements(analysis: validated_analysis)

          # Include the raw AI response in the result
          {
            requirements: requirements,
            raw_ai_analysis: raw_response,
            parsed_analysis: validated_analysis
          }
        end

        private

        def analyze_query_intent(params:)
          client = OpenAI::Client.new(access_token: ENV["OPENAI_API_KEY"])

          system_prompt = build_analysis_prompt(space_id: params[:space_id])
          user_query = params[:query]

          response = client.responses.create(
            parameters: {
              model: "gpt-3.5-turbo",
              conversation: { id: params[:openai_conversation_id] },
              input: user_query,
              temperature: 0.1,
              max_output_tokens: 1000,
              instructions: system_prompt
            }
          )

          analysis_text = response.dig("output", 0, "content", 0, "text")

          parsed_analysis = parse_analysis_response(analysis_text)

          Success({
            parsed_analysis: parsed_analysis,
            raw_response: analysis_text
          })
        rescue StandardError => e
          Failure(analysis_error: "Failed to analyze query intent: #{e.message}")
        end

        def validate_categories(analysis:, space_id:)
          # Fetch valid categories for this space
          valid_categories = fetch_expense_categories(space_id: space_id)

          # If categories filter exists, filter out invalid ones
          if analysis[:filters] && analysis[:filters][:categories]
            invalid_categories = analysis[:filters][:categories].reject do |category|
              # Check if category matches any valid category (case-insensitive)
              valid_categories.any? { |valid| valid.casecmp?(category) }
            end

            # Remove invalid categories
            analysis[:filters][:categories] = analysis[:filters][:categories].select do |category|
              valid_categories.any? { |valid| valid.casecmp?(category) }
            end

            # If invalid categories were found, move them to descriptions
            if invalid_categories.any?
              Rails.logger.warn "[AnalyzeQueryIntent] Invalid categories detected and moved to descriptions: #{invalid_categories.inspect}"
              analysis[:filters][:descriptions] ||= []
              analysis[:filters][:descriptions] = (analysis[:filters][:descriptions] + invalid_categories).uniq
            end

            # Remove categories filter if empty
            analysis[:filters].delete(:categories) if analysis[:filters][:categories].empty?
          end

          Success(analysis)
        rescue StandardError => e
          Rails.logger.error "[AnalyzeQueryIntent] Failed to validate categories: #{e.message}"
          Success(analysis) # Return original analysis if validation fails
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

        def build_analysis_prompt(space_id:)
          current_date = Date.current
          current_year = current_date.year

          # Fetch expense categories for this space
          expense_categories = fetch_expense_categories(space_id:)

          <<~PROMPT
            You are a financial data analyst AI. Analyze user queries about personal finance and determine exactly what data is needed to answer them accurately.

            CURRENT DATE CONTEXT:
            - Today is #{current_date.strftime("%B %d, %Y")}
            - Current year: #{current_year}
            - Current month: #{current_date.strftime("%B")}

            AVAILABLE EXPENSE CATEGORIES:
            The following expense categories are available in this space. When users mention categories in their queries, use these exact names:
            #{format_categories_list(expense_categories)}

            CRITICAL CATEGORY RULES:
            - ONLY use category names from the AVAILABLE EXPENSE CATEGORIES list above
            - If a user mentions something that is NOT in the category list (e.g., "coffee", "groceries", "restaurant"), it should go in the "descriptions" filter, NOT in "categories"
            - The "categories" filter should ONLY contain exact matches from the AVAILABLE EXPENSE CATEGORIES list
            - If the user asks about something that doesn't match any category, use "descriptions" filter instead (e.g., "coffee" → descriptions: ["coffee"], NOT categories: ["coffee"])
            - Never invent or guess category names - only use what's in the list above

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

            IMPORTANT RULES:
            - If query_type is "transaction_search", set aggregations.group_by to [] (empty array). transaction_search finds individual transactions, NOT aggregated data.
            - If query_type is "spending_analysis" or "income_analysis", aggregations.group_by is required and should not be empty.

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
                "categories": ["ONLY use exact category names from AVAILABLE EXPENSE CATEGORIES list above. If the user mentions something not in that list, DO NOT put it here - use descriptions instead"],
                "accounts": ["specific account names if mentioned"],
                "descriptions": ["specific description keywords for what is bought or merchant names (e.g., "coffee", "Starbucks", "groceries", "restaurant"). Use this for items/products/merchants that are NOT in the categories list"],
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
              "limit": 10,
              "chart_suggestion": {
                "should_include_chart": true|false,
                "chart_type": "pie|bar|line|area",
                "chart_reason": "explanation of why this chart would be helpful"
              }
            }

            QUERY TYPE GUIDELINES:
            - "transaction_search": Use when asking for SPECIFIC INDIVIDUAL TRANSACTIONS (e.g., "biggest expense", "most expensive purchase", "highest amount spent", "find transaction for X"). Returns individual transaction records. DO NOT use group_by.
            - "spending_analysis": Use when asking for AGGREGATED SPENDING (totals, breakdowns by category/account, spending summaries). Requires group_by for aggregations.
            - "income_analysis": Use when asking about income totals or breakdowns.
            - "trend_analysis": Use when asking about spending/income over time periods.

            KEY DISTINCTION:
            - "What's my biggest expense?" = transaction_search (single largest transaction)
            - "What category do I spend most on?" = spending_analysis with group_by: ["category"] (category with highest total)

            LIMIT GUIDELINES:
            - Use limit: 1 ONLY when asking for a SINGLE top result (e.g., "biggest category", "top merchant", "highest spending month")
            - When asking for breakdowns "per [time period]" or "by [time period]" (e.g., "spending per month", "expenses by month", "monthly spending"), use a reasonable limit:
              * "per month" or "by month" → limit: 12 (show up to 12 months)
              * "per week" or "by week" → limit: 52 (show up to 52 weeks, or use 26 for 6 months)
              * "per day" or "by day" → limit: 30 (show up to 30 days, or use 7 for a week)
            - When asking for "all" or "every" (e.g., "all categories", "every month"), use limit: 50 (maximum)
            - When asking for "top N" (e.g., "top 5", "top 10"), use that specific number as the limit
            - Default limit for grouped breakdowns without specific number: 10-12 for time periods, 10 for categories/accounts/descriptions

            Examples:
            - "What's my biggest expense?" or "What's the most expensive thing I bought?" → query_type: "transaction_search", filters: {transaction_type: ["expense"]}, sorting: {field: "amount", direction: "desc"}, limit: 1, chart_suggestion: {should_include_chart: false, chart_type: null, chart_reason: "Single transaction doesn't need visualization"}
            - "What category do I spend most on?" or "What's my biggest spending category?" → query_type: "spending_analysis", filters: {transaction_type: ["expense"]},group_by: ["category"], metrics: ["sum", "count"], sorting: {field: "amount", direction: "desc"}, limit: 1, chart_suggestion: {should_include_chart: true, chart_type: "pie", chart_reason: "Visual breakdown of spending by category"}
            - "What's my biggest spend per month?" or "Show my spending per month" → query_type: "spending_analysis", filters: {transaction_type: ["expense"]}, group_by: ["month"], metrics: ["max", "sum"], sorting: {field: "amount", direction: "desc"}, limit: 12, chart_suggestion: {should_include_chart: true, chart_type: "bar", chart_reason: "Bar chart shows monthly spending comparison"}
            - "What's my monthly spending breakdown?" → query_type: "spending_analysis", filters: {transaction_type: ["expense"]}, group_by: ["month"], metrics: ["sum"], sorting: {field: "date", direction: "desc"}, limit: 12, chart_suggestion: {should_include_chart: true, chart_type: "line", chart_reason: "Line chart shows monthly trends"}
            - "How much did I spend on coffee this month" → query_type: "spending_analysis", filters: {transaction_type: ["expense"]}, descriptions: ["coffee"]}, time_range: {period: "this_month"}, metrics: ["sum", "count"], chart_suggestion: {should_include_chart: false, chart_type: null, chart_reason: "Single description query doesn't need visualization"}
            - "How much did I spend on Food & Groceries this month" → query_type: "spending_analysis", filters: {transaction_type: ["expense"]}, categories: ["Food & Groceries"], time_range: {period: "this_month"}, metrics: ["sum", "count"], chart_suggestion: {should_include_chart: false, chart_type: null, chart_reason: "Single category query doesn't need visualization"}
            - "Show my top 5 merchants" → query_type: "spending_analysis", group_by: ["description"], metrics: ["sum", "count"], sorting: {field: "amount", direction: "desc"}, limit: 5, chart_suggestion: {should_include_chart: true, chart_type: "bar", chart_reason: "Bar chart shows comparison between merchants"}
            - "What's my income for September" → query_type: "income_analysis", filters: {transaction_type: ["income"]}, time_range: {period: "custom", start_date: "#{current_year - 1}-09-01", end_date: "#{current_year - 1}-09-30"}, metrics: ["sum", "count"], chart_suggestion: {should_include_chart: false, chart_type: null, chart_reason: "Single value doesn't need visualization"}
            - "How much did I spend last month" → query_type: "spending_analysis", filters: {transaction_type: ["expense"]}, time_range: {period: "custom", start_date: "#{current_date.last_month.beginning_of_month.strftime("%Y-%m-%d")}", end_date: "#{current_date.last_month.end_of_month.strftime("%Y-%m-%d")}"}, metrics: ["sum", "count"], chart_suggestion: {should_include_chart: false, chart_type: null, chart_reason: "Single total amount doesn't need visualization"}
            - "Show my spending trends" → query_type: "trend_analysis", filters: {transaction_type: ["expense"]}, group_by: ["month"], metrics: ["sum"], chart_suggestion: {should_include_chart: true, chart_type: "line", chart_reason: "Line chart shows trends over time"}
            - "Breakdown my expenses by category" → query_type: "spending_analysis", filters: {transaction_type: ["expense"]}, group_by: ["category"], metrics: ["sum"], chart_suggestion: {should_include_chart: true, chart_type: "pie", chart_reason: "Pie chart shows proportional spending by category"}
            - "Find my most expensive purchase" → query_type: "transaction_search", filters: {transaction_type: ["expense"]}, sorting: {field: "amount", direction: "desc"}, limit: 1, chart_suggestion: {should_include_chart: false, chart_type: null, chart_reason: "Single transaction doesn't need visualization"}
            - "What's the highest amount I've ever spent?" → query_type: "transaction_search", filters: {transaction_type: ["expense"]}, sorting: {field: "amount", direction: "desc"}, limit: 1, chart_suggestion: {should_include_chart: false, chart_type: null, chart_reason: "Single transaction doesn't need visualization"}

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
            limit: [parsed[:limit] || 10, 50].min, # Cap at 50 results
            chart_suggestion: parsed[:chart_suggestion] || { should_include_chart: false, chart_type: nil, chart_reason: nil }
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
            limit: 10,
            chart_suggestion: { should_include_chart: false, chart_type: nil, chart_reason: nil }
          }
        end

        def fetch_expense_categories(space_id:)
          space = Spaces::Space.find_by(id: space_id)
          return [] unless space

          space.expense_categories.order(name: :asc).pluck(:name)
        rescue StandardError => e
          Rails.logger.error "[AnalyzeQueryIntent] Failed to fetch expense categories: #{e.message}"
          []
        end

        def format_categories_list(categories)
          return "- No expense categories found" if categories.empty?

          categories.map { |category| "- #{category}" }.join("\n")
        end
        end
      end
    end
  end
end
