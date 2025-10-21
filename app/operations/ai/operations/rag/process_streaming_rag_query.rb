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

          # Still do vector search for additional context
          search_results = step perform_vector_search(params:)

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

        def perform_vector_search(params:)
          Ai::Operations::Rag::SearchVectors.new.call(
            query: params[:query],
            space_id: params[:space_id],
            limit: 10,
            threshold: 0.7,
            embeddable_type: nil,
            filters: nil
          )
        end

        def build_enhanced_prompt(structured_data:, search_results:, params:, requirements:)
          # Format structured data for the prompt
          structured_context = format_structured_data_for_prompt(structured_data)

          # Get vector search context
          relevant_docs = search_results[:results].map do |result|
            "#{result[:content]} (Similarity: #{(result[:similarity_score] * 100).round(1)}%)"
          end.join("\n\n")

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

            USER QUERY: #{params[:query]}

            Instructions:
            1. Use the STRUCTURED FINANCIAL DATA as your primary source of truth
            2. Provide specific, accurate numbers from the data
            3. Reference actual transactions, categories, and amounts
            4. If the data shows clear patterns, highlight them
            5. Be conversational but precise
            6. When the structured data outputs "Initial Balance" don't count it in your calculations. They're supposed to be there to show how much an account has.
            7. When outputting your answers, make sure to only consider what the USER QUERY is. No need to talk about the additional data sent to you.

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

        def format_structured_data_for_prompt(structured_data)
          return "No relevant data found." if structured_data[:raw_data].empty?

          case structured_data[:query_type]
          when "spending_analysis", "income_analysis"
            format_spending_data(structured_data[:raw_data])
          when "trend_analysis"
            format_trend_data(structured_data[:raw_data])
          else
            format_transaction_data(structured_data[:raw_data])
          end
        end

        def format_spending_data(data)
          if data.first.is_a?(Hash) && data.first[:sum]
            # Grouped data
            data.map do |item|
              group_name = item[:group].join(" - ")
              amount = item.dig(:sum, :amount) || "N/A"
              count = item[:count] || 0
              "#{group_name}: #{amount} (#{count} transactions)"
            end.join("\n")
          else
            # Individual transactions
            data.map do |transaction|
              "#{transaction[:date]}: #{transaction[:description]} - #{transaction[:amount]} (#{transaction[:category]})"
            end.join("\n")
          end
        end

        def format_trend_data(data)
          data.map do |trend|
            "#{trend[:period]}: #{trend[:amount]}"
          end.join("\n")
        end

        def format_transaction_data(data)
          data.map do |transaction|
            "#{transaction[:date]}: #{transaction[:description]} - #{transaction[:amount]} (#{transaction[:category]}) [#{transaction[:type]}]"
          end.join("\n")
        end
      end
    end
  end
end
