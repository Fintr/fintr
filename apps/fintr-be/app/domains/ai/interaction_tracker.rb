# frozen_string_literal: true

module Ai
  # Tracks AI interactions for analytics and debugging
  class InteractionTracker
    def initialize(model: nil)
      @model = model || Ai::Interaction
    end

    # Start tracking a new interaction
    # @param session_id [String]
    # @param user_id [String]
    # @param space_id [String]
    # @param query [String]
    # @return [TrackedInteraction]
    def track(
      session_id:,
      user_id:,
      space_id:,
      query:
    )
      interaction = @model.create_from_chat_session(
        session_id,
        user_id,
        space_id,
        query,
      )

      TrackedInteraction.new(interaction)
    rescue StandardError => e
      Rails.logger.warn "[InteractionTracker] Could not create interaction: #{e.message}"
      nil
    end

    # Wrapper for tracked interaction
    class TrackedInteraction
      def initialize(interaction)
        @interaction = interaction
      end

      # @param response [String] Full AI response text
      # @param metadata [Hash] Optional RAG/analytics (query_type, data_sources, filters, structured_data_count, vector_results_count)
      # @param enhanced_prompt [String, nil] Full prompt sent to the LLM (for debugging)
      # @param time_seconds [Float, nil] Elapsed time; uses estimate if nil
      # @param tokens_used [Integer, nil] Actual token count; uses estimate if nil
      def complete!(
        response,
        metadata: {},
        enhanced_prompt: nil,
        time_seconds: nil,
        tokens_used: nil
      )
        @interaction&.update_with_response(
          response,
          tokens_used || estimate_tokens(response),
          time_seconds.to_f,
          metadata,
          enhanced_prompt.to_s,
        )
      end

      def fail!(error_message)
        @interaction&.update_with_error(error_message)
      end

      private

      def estimate_tokens(content)
        (content.to_s.length / 4.0).ceil
      end
    end
  end
end
