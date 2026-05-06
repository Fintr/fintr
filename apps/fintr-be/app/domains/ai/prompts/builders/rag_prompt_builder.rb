# frozen_string_literal: true

module Ai
  module Prompts
    module Builders
      class RagPromptBuilder
        def build(query:, analysis:, structured_data:, vector_results:, conversation_id: nil)
          context = build_context_section(conversation_id)
          structured_section = format_structured_data(structured_data, analysis)
          # Pass raw array of hashes so template can render RELEVANT CONTEXT (template expects Array of Hashes, not a pre-formatted string)
          vector_results_array = Array(vector_results).select { |r| r.is_a?(Hash) }

          PromptService.rag_prompt(
            query: query,
            analysis: analysis,
            structured_data: structured_section,
            vector_results: vector_results_array,
            conversation_context: context
          )
        end

        private

        def build_context_section(conversation_id)
          return "" unless conversation_id.present?

          builder = Ai::Conversations::ContextBuilder.new(conversation_id: conversation_id)
          builder.load_recent_context || ""
        end

        def format_structured_data(data, analysis)
          return "No relevant data found." if data.blank? || data.empty?

          case analysis.query_type
          when "spending_analysis", "income_analysis"
            format_spending_data(data)
          when "trend_analysis"
            format_trend_data(data)
          when "transaction_search"
            format_transaction_data(data)
          else
            data.to_s
          end
        end

        def format_spending_data(data)
          return "No data found." if data.nil? || data.empty?

          if data.is_a?(Array) && data.first.is_a?(Hash)
            format_grouped_data(data)
          else
            format_transaction_list(data)
          end
        end

        def format_grouped_data(data)
          data.map do |item|
            group_name = extract_group_name(item)
            amount = item.dig(:sum, :amount) || item[:amount] || "N/A"
            count = item[:count] || 0

            "#{group_name}: #{amount} (#{count} transactions)"
          end.join("\n")
        end

        def extract_group_name(item)
          if item[:group].is_a?(Array)
            item[:group].join(" - ")
          elsif item[:group].respond_to?(:strftime)
            item[:group].strftime("%B %Y")
          else
            item[:group].to_s
          end
        end

        def format_transaction_list(data)
          data.first(15).map do |transaction|
            date = transaction[:date] || "Unknown date"
            description = transaction[:description] || "No description"
            amount = transaction[:amount] || "N/A"
            category = transaction[:category] || "Uncategorized"

            "#{date}: #{description} - #{amount} (#{category})"
          end.join("\n")
        end

        def format_trend_data(data)
          return "No trend data found." if data.nil? || data.empty?

          data.map do |trend|
            period = trend[:period] || "Unknown period"
            amount = trend[:amount] || "N/A"
            "#{period}: #{amount}"
          end.join("\n")
        end

        def format_transaction_data(data)
          return "No transaction data found." if data.nil? || data.empty?

          data.first(15).map do |transaction|
            date = transaction[:date] || "Unknown date"
            description = transaction[:description] || "No description"
            amount = transaction[:amount] || "N/A"
            category = transaction[:category] || "Uncategorized"
            type = transaction[:type] || "Unknown"

            "#{date}: #{description} - #{amount} (#{category}) [#{type}]"
          end.join("\n")
        end

        def format_vector_results(results)
          return "No relevant documents found." if results.blank?

          Array(results).first(15).map do |result|
            content = result[:content].to_s.truncate(200)
            score = (result[:similarity_score].to_f * 100).round(1)

            "#{content} (Similarity: #{score}%)"
          end.join("\n\n")
        end
      end
    end
  end
end
