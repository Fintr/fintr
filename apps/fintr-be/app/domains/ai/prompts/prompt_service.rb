# frozen_string_literal: true

module Ai
  module Prompts
    # Service for building prompts
    # Centralizes prompt creation logic
    class PromptService
      class << self
        # Build analysis prompt
        # @param query [String]
        # @param space_id [String]
        # @param context [String, nil]
        # @return [String]
        def analysis_prompt(
          query:,
          space_id:,
          context: nil
        )
          template = Templates::AnalysisTemplate.new(
            space_id: space_id,
          )

          template.render(
            query: query,
            context: context,
          )
        end

        # Build RAG prompt
        # @param query [String]
        # @param analysis [Hash]
        # @param structured_data [Array, Hash]
        # @param vector_results [Array]
        # @param conversation_context [String, nil]
        # @return [String]
        def rag_prompt(
          query:,
          analysis:,
          structured_data:,
          vector_results:,
          conversation_context: nil
        )
          template = Templates::RagTemplate.new

          template.render(
            query: query,
            analysis: analysis,
            structured_data: structured_data,
            vector_results: vector_results,
            conversation_context: conversation_context,
          )
        end
      end
    end
  end
end
