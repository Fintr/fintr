# frozen_string_literal: true

module Ai
  module Prompts
    module Templates
      # Template for RAG response prompts
      class RagTemplate
        def render(
          query:,
          analysis:,
          structured_data:,
          vector_results:,
          conversation_context: nil
        )
          prompt = ""
          prompt += context_section(conversation_context) if conversation_context.present?
          prompt += base_instructions
          prompt += data_section(structured_data)
          prompt += search_section(vector_results)
          prompt += analysis_section(analysis)
          prompt += chart_instructions
          prompt += query_section(query)
          prompt
        end

        private

        def context_section(context)
          "Previous conversation context:\n#{context}\n\n"
        end

        def base_instructions
          <<~INSTRUCTIONS
            You are a financial assistant with access to the user's data. Provide accurate, data-driven responses.

            FORMATTING:
            - Use proper punctuation and spacing: space after commas, periods, and between words.
            - Format dates as "Month DD, YYYY" (e.g. February 16, 2026), not "February16,2026".
            - Use standard spacing around numbers and currency (e.g. "₱532,847.64" with no extra spaces inside the number).

          INSTRUCTIONS
        end

        def data_section(data)
          return "" if data.empty?

          <<~DATA
            STRUCTURED DATA:
            #{format_data(data)}

          DATA
        end

        def search_section(results)
          results_list = Array(results).select { |r| r.is_a?(Hash) }
          return "" if results_list.empty?

          <<~SEARCH
            RELEVANT CONTEXT:
            #{format_search_results(results_list)}

          SEARCH
        end

        def analysis_section(analysis)
          <<~ANALYSIS
            QUERY ANALYSIS:
            - Type: #{analysis[:query_type]}
            - Time Range: #{analysis[:time_range]&.dig(:period) || 'unspecified'}
            - Filters: #{analysis[:filters]&.to_json || 'none'}

          ANALYSIS
        end

        def chart_instructions
          <<~CHARTS
            CHART INSTRUCTIONS:
            - Maximum 6 data points per chart
            - Sort by value (descending)
            - Use "Others" for remaining items with color #9CA3AF
            - Format: *****[type]-chart***** { data } *****[type]-chart-end*****
            - Supported: pie, bar, line, area

          CHARTS
        end

        def query_section(query)
          "User Query: #{query}"
        end

        def format_data(data)
          case data
          when Array
            data.map { |item| "- #{item}" }.join("\n")
          when Hash
            data.map { |k, v| "- #{k}: #{v}" }.join("\n")
          else
            data.to_s
          end
        end

        def format_search_results(results)
          results_list = Array(results).select { |r| r.is_a?(Hash) }
          return "" if results_list.empty?

          results_list.first(5).map do |result|
            content = (result[:content] || result["content"]).to_s.truncate(150)
            score = ((result[:similarity_score] || result["similarity_score"]).to_f * 100).round(1)
            "- #{content} (relevance: #{score}%)"
          end.join("\n")
        end
      end
    end
  end
end
