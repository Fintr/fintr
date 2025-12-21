# frozen_string_literal: true

module Ai
  module Operations
    module Rag
      class ProcessStreamingRagQuery < Dry::Operation
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

          # First, analyze what data the AI actually needs
          analysis_result = step analyze_query_intent(params:)
          data_requirements = analysis_result[:requirements]
          raw_ai_analysis = analysis_result[:raw_ai_analysis]

          # Retrieve structured data based on AI analysis
          structured_data = step retrieve_structured_data(params:, requirements: data_requirements)

          # Perform vector search with specialized filters from query analysis
          search_results = step perform_vector_search(
            params:,
            requirements: data_requirements
          )

          # Build enhanced prompt with both structured data and vector search results
          enhanced_prompt = step build_enhanced_prompt(
            structured_data:,
            search_results:,
            params:,
            requirements: data_requirements
          )

          # Return all the data needed for streaming - don't call LLM here
          {
            enhanced_prompt: enhanced_prompt,
            user_query: params[:user_query],
            structured_data: structured_data,
            search_results: search_results,
            data_requirements: data_requirements,
            raw_ai_analysis: raw_ai_analysis
          }
        end

        private

        def analyze_query_intent(params:)
          Ai::Operations::Rag::Analysis::AnalyzeQueryIntent.new.call(
            query: params[:query],
            space_id: params[:space_id],
            openai_conversation_id: params[:openai_conversation_id]
          )
        end

        def retrieve_structured_data(params:, requirements:)
          Ai::Operations::Rag::Data::RetrieveStructuredData.new.call(
            space_id: params[:space_id],
            data_requirements: requirements
          )
        end

        def perform_vector_search(params:, requirements:)
          # Build filters from requirements to specialize the vector search
          filters = build_vector_search_filters(requirements:)

          # Determine embeddable_type based on data_sources
          embeddable_type = determine_embeddable_type(requirements:)

          # Adjust limit and threshold based on query type
          limit, threshold = adjust_search_parameters(requirements:)

          # Determine if we should sort by amount (for "biggest expense" type queries)
          sort_by_amount = should_sort_by_amount?(requirements:)

          Ai::Operations::Rag::SearchVectors.new.call(
            query: params[:query],
            space_id: params[:space_id],
            limit: limit,
            threshold: threshold,
            embeddable_type: embeddable_type,
            filters: filters,
            sort_by_amount: sort_by_amount
          )
        end

        def should_sort_by_amount?(requirements:)
          # Sort by amount if:
          # 1. Query type is transaction_search (looking for specific transactions)
          # 2. Sorting field is "amount" with direction "desc"
          # 3. Query mentions "biggest", "largest", "most expensive", "highest"
          query_type = requirements[:query_type]
          sorting = requirements[:sorting] || {}

          is_amount_sort = sorting[:field] == "amount" && sorting[:direction] == "desc"
          is_transaction_search = query_type == "transaction_search"

          is_amount_sort && is_transaction_search
        end

        def build_vector_search_filters(requirements:)
          filters = {}

          # Map transaction_type from requirements to filters
          if requirements[:filters]&.dig(:transaction_type)&.any?
            transaction_type = requirements[:filters][:transaction_type].first
            filters[:transaction_type] = transaction_type
          end

          # Map category filters (take first category if multiple, or use ILIKE for partial match)
          if requirements[:filters]&.dig(:categories)&.any?
            # For vector search, we'll use the first category or a keyword match
            category = requirements[:filters][:categories].first
            filters[:category] = category
          end

          # Map account filters
          if requirements[:filters]&.dig(:accounts)&.any?
            account = requirements[:filters][:accounts].first
            filters[:account] = account
          end

          # Map time_range to date filters
          if requirements[:time_range]
            time_range = requirements[:time_range]
            filters[:date_from] = time_range[:start_date] if time_range[:start_date].present?
            filters[:date_to] = time_range[:end_date] if time_range[:end_date].present?
          end

          filters.present? ? filters : nil
        end

        def determine_embeddable_type(requirements:)
          # If data_sources specifies what we need, we can filter by embeddable_type
          data_sources = requirements[:data_sources] || []

          # Map data_sources to embeddable_types
          if data_sources.include?("transactions")
            "Transactions::Transaction"
          elsif data_sources.include?("transfers")
            "Transfers::Transfer"
          elsif data_sources.include?("budgets")
            "Budgets::Budget"
          elsif data_sources.include?("accounts")
            "Accounts::Account"
          else
            nil # Search all types
          end
        end

        def adjust_search_parameters(requirements:)
          query_type = requirements[:query_type]

          case query_type
          when "transaction_search"
            # For specific transaction searches, we want more results but higher quality
            [30, 0.6] # More results, slightly lower threshold
          when "trend_analysis"
            # For trends, we want a good spread of data
            [25, 0.65]
          when "spending_analysis", "income_analysis"
            # For spending/income analysis, focus on relevant transactions
            [20, 0.7]
          else
            # Default: balanced approach
            [20, 0.7]
          end
        end

        def build_enhanced_prompt(structured_data:, search_results:, params:, requirements:)
          # Format structured data for the prompt
          structured_context = format_structured_data_for_prompt(structured_data, requirements:)

          # Check if we have no data early - look for explicit "no data" messages in structured context
          # or if both structured data and vector search results are empty
          has_no_structured_data = structured_context.match?(/No (data|relevant data|transaction data|trend data) found/i) ||
                                  structured_data[:raw_data].empty?

          has_no_vector_data = search_results[:results].blank?

          has_no_data = has_no_structured_data && has_no_vector_data

          # If there's no data, return a simplified prompt
          if has_no_data
            return Success(build_no_data_prompt(params:, requirements:))
          end

          # Get vector search context - limit and truncate to prevent context length issues
          relevant_docs = if search_results[:results]&.any?
            search_results[:results].first(15).map do |result|
              # Truncate each result to max 200 characters to save tokens
              truncated_content = result[:content].length > 200 ? result[:content][0..200] + "..." : result[:content]
              "#{truncated_content} (Similarity: #{(result[:similarity_score] * 100).round(1)}%)"
            end.join("\n\n")
          else
            "No relevant documents found from vector search."
          end

          # Detect if this is a "single result" query (biggest, largest, top 1, etc.)
          is_single_result_query = requirements[:limit] == 1 &&
                                   requirements.dig(:sorting, :field) == "amount" &&
                                   requirements.dig(:sorting, :direction) == "desc"

          single_result_instruction = if is_single_result_query
            "\n\nIMPORTANT: This query asks for a SINGLE result (biggest/largest/top expense). The FIRST item in the STRUCTURED FINANCIAL DATA is the direct answer. State it clearly and directly (e.g., 'Your biggest expense is [category] at [amount]'). Do not list multiple items or provide a breakdown unless the user specifically asks for it."
          else
            ""
          end

          base_prompt = <<~PROMPT
            You are a financial assistant with access to the user's complete financial data. You can provide accurate, data-driven insights.

            STRUCTURED FINANCIAL DATA:
            #{structured_context}

            DATA FROM VECTOR SEARCH:
            #{relevant_docs}

            QUERY ANALYSIS:
            The user's query was analyzed as: #{requirements[:query_type]}
            Data retrieved: #{structured_data[:data_summary]}
            Chart suggestion: #{requirements[:chart_suggestion]}
            Limit: #{requirements[:limit]} result(s)
            Sorting: #{requirements.dig(:sorting, :field)} (#{requirements.dig(:sorting, :direction)})

            USER QUERY: #{params[:query]}

            Instructions:
            1. Use the STRUCTURED FINANCIAL DATA as your primary source of truth
            2. Provide specific, accurate numbers from the data
            3. Reference actual transactions, categories, and amounts
            4. If the data shows clear patterns, highlight them
            5. Be conversational but precise
            6. When the structured data outputs "Initial Balance" don't count it in your calculations. They're supposed to be there to show how much an account has.
            7. When outputting your answers, make sure to only consider what the USER QUERY is. No need to talk about the additional data sent to you.#{single_result_instruction}

            CHART GENERATION:
            When your response would benefit from visual representation, include charts using this format:

            *****[chart-type]-chart*****
            {
              "Category1": { "value": 1000, "color": "#008080" },
              "Category2": { "value": 500, "color": "#FF6F61" },
              "Category3": { "value": 300, "color": "#CC5500" }
            }
            *****[chart-type]-chart-end*****

            Supported chart types: pie, bar, line, area

            Use charts when:
            - Showing spending breakdown by category
            - Comparing different time periods
            - Displaying trends over time
            - Showing income vs expenses
            - Any data that would be clearer visually

            Chart data should be in this format:
            - Keys: category names, time periods, or data labels
            - Values: objects with "value" (numeric) and optional "color" (hex color)
            - Colors: Use these brand colors: #008080 (Teal), #FF6F61 (Coral pink), #CC5500 (Burnt orange), #0A3D62 (Deep navy), #E6B800 (Soft gold), #B5E3C8 (Pale mint), #87CEEB (Sky blue), #D4B483 (Warm sand), #C4C3D0 (Lavender gray)

            Please provide a comprehensive response based on the actual financial data above.
          PROMPT

          Success(base_prompt)
        end

        def build_no_data_prompt(params:, requirements:)
          <<~PROMPT
            You are a financial assistant. The user asked: "#{params[:query]}"

            IMPORTANT: There is NO DATA available that matches the user's query. The database search returned no results.

            You MUST explicitly tell the user that you could not find any data matching their query. Be clear, direct, and helpful. Use phrases like:
            - "I couldn't find any data matching your query"
            - "No data is available for this request"
            - "I don't have any records that match your question"
            - "There's no data available that matches what you're looking for"

            Do NOT:
            - Make up data or provide generic responses
            - Provide calculations or estimates
            - Suggest data that doesn't exist
            - Be vague or unclear

            Be conversational and helpful, but make it clear that no data was found.
          PROMPT
        end

        def format_structured_data_for_prompt(structured_data, requirements: {})
          return "No relevant data found." if structured_data[:raw_data].empty?

          case structured_data[:query_type]
          when "spending_analysis", "income_analysis"
            format_spending_data(structured_data[:raw_data], requirements:)
          when "trend_analysis"
            format_trend_data(structured_data[:raw_data], requirements:)
          when "transaction_search"
            format_transaction_data(structured_data[:raw_data], requirements:)
          else
            format_transaction_data(structured_data[:raw_data], requirements:)
          end
        end

        def format_spending_data(data, requirements: {})
          return "No data found." if data.nil? || data.empty?

          # Normalize keys to symbols
          normalized_data = normalize_keys(data)

          # Check if this is a single-result query (biggest/largest/top 1)
          is_single_result = requirements[:limit] == 1 &&
                            requirements.dig(:sorting, :field) == "amount" &&
                            requirements.dig(:sorting, :direction) == "desc"

          # Check if this is grouped data (has :group or :group_fields key, or has metric keys like :sum, :max, :min, :average)
          first_item = normalized_data.first
          is_grouped = first_item.is_a?(Hash) && (
            first_item[:group] ||
            first_item[:group_fields] ||
            first_item[:sum] ||
            first_item[:max] ||
            first_item[:min] ||
            first_item[:average]
          )

          if is_grouped
            # Grouped data
            formatted_items = normalized_data.map do |item|
              # Format group name
              group_name = if item[:group].is_a?(Array)
                # Format date arrays nicely
                if item[:group_fields]&.include?("month") || item[:group_fields]&.include?("week") || item[:group_fields]&.include?("day")
                  item[:group].first.strftime("%B %Y") rescue item[:group].join(" - ")
                else
                  item[:group].join(" - ")
                end
              elsif item[:group].respond_to?(:strftime)
                # Single date value
                item[:group].strftime("%B %d, %Y")
              else
                item[:group].to_s
              end

              # Get amount from sum, max, min, or average (prefer sum, then max)
              amount = item.dig(:sum, :amount) ||
                      item.dig(:max, :amount) ||
                      item.dig(:min, :amount) ||
                      item.dig(:average, :amount) ||
                      "N/A"
              count = item[:count] || 0

              "#{group_name}: #{amount} (#{count} transaction#{count != 1 ? 's' : ''})"
            end

            # Add emphasis for single-result queries
            if is_single_result && formatted_items.any?
              "BIGGEST/LARGEST RESULT (sorted by amount, descending):\n#{formatted_items.first}"
            else
              formatted_items.join("\n")
            end
          else
            # Individual transactions
            formatted_items = normalized_data.map do |transaction|
              date = transaction[:date] || "Unknown date"
              description = transaction[:description] || "No description"
              amount = transaction[:amount] || "N/A"
              category = transaction[:category] || "Uncategorized"

              "#{date}: #{description} - #{amount} (#{category})"
            end

            # Add emphasis for single-result queries
            if is_single_result && formatted_items.any?
              "BIGGEST/LARGEST TRANSACTION (sorted by amount, descending):\n#{formatted_items.first}"
            else
              formatted_items.join("\n")
            end
          end
        end

        def format_trend_data(data, requirements: {})
          return "No trend data found." if data.nil? || data.empty?

          # Normalize keys to symbols
          normalized_data = normalize_keys(data)

          normalized_data.map do |trend|
            period = trend[:period] || "Unknown period"
            amount = trend[:amount] || "N/A"
            "#{period}: #{amount}"
          end.join("\n")
        end

        def format_transaction_data(data, requirements: {})
          return "No transaction data found." if data.nil? || data.empty?

          # Normalize keys to symbols
          normalized_data = normalize_keys(data)

          # Check if this is a single-result query (biggest/largest/top 1)
          is_single_result = requirements[:limit] == 1 &&
                            requirements.dig(:sorting, :field) == "amount" &&
                            requirements.dig(:sorting, :direction) == "desc"

          formatted_items = normalized_data.map do |transaction|
            date = transaction[:date] || "Unknown date"
            description = transaction[:description] || "No description"
            amount = transaction[:amount] || "N/A"
            category = transaction[:category] || "Uncategorized"
            type = transaction[:type] || "Unknown"

            "#{date}: #{description} - #{amount} (#{category}) [#{type}]"
          end

          # Add emphasis for single-result queries
          if is_single_result && formatted_items.any?
            "BIGGEST/LARGEST TRANSACTION (sorted by amount, descending):\n#{formatted_items.first}"
          else
            formatted_items.join("\n")
          end
        end

        def normalize_keys(data)
          case data
          when Array
            data.map { |item| item.is_a?(Hash) ? item.deep_symbolize_keys : item }
          when Hash
            data.deep_symbolize_keys
          else
            data
          end
        end
      end
    end
  end
end
