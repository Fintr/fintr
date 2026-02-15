# frozen_string_literal: true

module Ai
  # Adapter to integrate new SOLID architecture with existing operations
  # Provides backward compatibility during migration
  module Adapter
    # Wraps the new RAG pipeline for use with existing operations
    class RagAdapter
      def initialize(
        pipeline: nil,
        query_analyzer: nil
      )
        @pipeline = pipeline || Rag::RagPipeline.new
        @query_analyzer = query_analyzer || Rag::QueryAnalyzer.new
      end

      # Execute RAG pipeline - compatible with existing ProcessStreamingRagQuery
      # @param query [String]
      # @param space_id [String]
      # @param conversation_id [String, nil]
      # @return [Hash] Result compatible with existing code
      def execute(
        query:,
        space_id:,
        conversation_id: nil
      )
        result = @pipeline.execute(
          query: query,
          space_id: space_id,
          conversation_id: conversation_id,
        )

        # Convert to format expected by existing code
        {
          enhanced_prompt: result[:prompt],
          user_query: query,
          structured_data: result[:structured_data],
          search_results: result[:vector_results],
          data_requirements: result[:analysis],
          raw_ai_analysis: result[:analysis].to_json,
        }
      rescue StandardError => e
        Rails.logger.error "[RagAdapter] Error: #{e.message}"
        raise
      end

      # Analyze query - compatible with existing AnalyzeQueryIntent
      # @param query [String]
      # @param space_id [String]
      # @param conversation_context [String, nil]
      # @return [Hash] Analysis result
      def analyze(
        query:,
        space_id:,
        conversation_context: nil
      )
        result = @query_analyzer.analyze(
          query: query,
          space_id: space_id,
          conversation_context: conversation_context,
        )

        # Convert AnalysisResult to Hash
        result.to_h
      rescue StandardError => e
        Rails.logger.error "[RagAdapter] Analysis error: #{e.message}"
        raise
      end
    end

    # Wraps conversation operations
    class ConversationAdapter
      def initialize(service: nil)
        @service = service || Conversations::ConversationService.new
      end

      # Add message to conversation
      # @param conversation_id [String]
      # @param role [String]
      # @param content [String]
      # @param metadata [Hash]
      def add_message(
        conversation_id:,
        role:,
        content:,
        metadata: {}
      )
        case role.to_s
        when 'user'
          @service.add_user_message(
            conversation_id: conversation_id,
            content: content,
            metadata: metadata,
          )
        when 'assistant'
          @service.add_assistant_message(
            conversation_id: conversation_id,
            content: content,
            metadata: metadata,
          )
        else
          raise ArgumentError, "Unknown role: #{role}"
        end
      end
    end
  end
end
