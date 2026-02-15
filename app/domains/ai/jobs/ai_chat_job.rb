# frozen_string_literal: true

module Ai
  # Background job for AI chat processing
  # Uses new SOLID architecture
  class AiChatJob < ApplicationJob
    queue_as :default

    def initialize(
      rag_pipeline: nil,
      response_generator: nil,
      broadcaster: nil,
      interaction_tracker: nil,
      conversation_service: nil
    )
      super()
      @rag_pipeline = rag_pipeline || Rag::RagPipeline.new
      @response_generator = response_generator || ResponseGenerator.new
      @broadcaster = broadcaster || ChatBroadcaster.new
      @interaction_tracker = interaction_tracker || InteractionTracker.new
      @conversation_service = conversation_service || Conversations::ConversationService.new
    end

    def perform(
      session_id,
      query,
      space_id,
      user_id,
      conversation_id = nil
    )
      Rails.logger.info "[AI_CHAT_JOB] Starting job - session: #{session_id}, query: #{query}, conversation: #{conversation_id}"

      track_interaction(
        session_id,
        user_id,
        space_id,
        query,
      ) do |interaction|
        # Step 1: Execute RAG pipeline
        rag_result = execute_rag(
          query: query,
          space_id: space_id,
          conversation_id: conversation_id,
        )

        # Step 2: Broadcast metadata
        broadcast_metadata(
          conversation_id: conversation_id,
          rag_result: rag_result,
        )

        # Step 3: Generate streaming response
        response = generate_response(
          prompt: rag_result[:prompt],
          conversation_id: conversation_id,
          user_query: query,
        )

        # Step 4: Save response to conversation
        save_response(
          conversation_id: conversation_id,
          response: response,
          metadata: build_metadata(rag_result),
        )

        # Step 5: Complete
        @broadcaster.complete(
          conversation_id: conversation_id,
          content: response,
        )

        # Step 6: Track success
        interaction&.complete!(response)

        Rails.logger.info "[AI_CHAT_JOB] Completed successfully"

        response
      end
    rescue StandardError => e
      handle_error(
        e,
        conversation_id: conversation_id,
      )
      raise
    end

    private

    def execute_rag(
      query:,
      space_id:,
      conversation_id:
    )
      Rails.logger.info "[AI_CHAT_JOB] Executing RAG pipeline..."
      
      result = @rag_pipeline.execute(
        query: query,
        space_id: space_id,
        conversation_id: conversation_id,
      )
      
      Rails.logger.info "[AI_CHAT_JOB] RAG pipeline complete"
      result
    rescue StandardError => e
      Rails.logger.error "[AI_CHAT_JOB] RAG pipeline failed: #{e.class}: #{e.message}"
      Rails.logger.error "[AI_CHAT_JOB] RAG Backtrace: #{e.backtrace.first(5).join("\n")}"
      raise
    end

    def broadcast_metadata(
      conversation_id:,
      rag_result:
    )
      @broadcaster.metadata(
        conversation_id: conversation_id,
        analysis: rag_result[:analysis],
        data_summary: summarize_data(rag_result[:structured_data]),
      )
    end

    def generate_response(
      prompt:,
      conversation_id:,
      user_query:
    )
      content = +""

      @response_generator.generate(
        prompt: prompt,
        conversation_id: conversation_id,
        user_query: user_query,
        on_chunk: proc do |chunk|
          @broadcaster.chunk(
            conversation_id: conversation_id,
            content: content + chunk,
          )
        end,
      )
    end

    def save_response(
      conversation_id:,
      response:,
      metadata:
    )
      return unless conversation_id.present?

      @conversation_service.add_assistant_message(
        conversation_id: conversation_id,
        content: response,
        metadata: metadata,
      )
    end

    def build_metadata(rag_result)
      {
        query_type: rag_result[:analysis][:query_type],
        data_sources: rag_result[:analysis][:data_sources],
        timestamp: Time.current.iso8601,
      }
    end

    def summarize_data(data)
      case data
      when Array
        "#{data.length} records"
      when Hash
        "#{data.keys.length} categories"
      else
        "Data available"
      end
    end

    def track_interaction(
      session_id,
      user_id,
      space_id,
      query
    )
      interaction = @interaction_tracker.track(
        session_id: session_id,
        user_id: user_id,
        space_id: space_id,
        query: query,
      )

      yield interaction
    rescue StandardError => e
      interaction&.fail!(e.message)
      raise
    end

    def handle_error(
      error,
      conversation_id:
    )
      Rails.logger.error "[AI_CHAT_JOB] Error: #{error.class}: #{error.message}"
      Rails.logger.error "[AI_CHAT_JOB] Backtrace: #{error.backtrace.first(5).join("\n")}"

      # Only broadcast if we have a valid conversation_id
      if conversation_id.present?
        @broadcaster.error(
          conversation_id: conversation_id,
          error: error.message,
        )
      else
        Rails.logger.warn "[AI_CHAT_JOB] Cannot broadcast error - no conversation_id"
      end
    end
  end
end
