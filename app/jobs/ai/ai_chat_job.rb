# frozen_string_literal: true

module Ai
  # Main job for processing AI chat requests
  # Orchestrates the entire chat flow using SOLID architecture
  class AiChatJob < ApplicationJob
    queue_as :default

    # Execute the chat job
    # @param session_id [String]
    # @param query [String]
    # @param space_id [String]
    # @param user_id [String]
    # @param conversation_id [String, nil]
    def perform(
      session_id,
      query,
      space_id,
      user_id,
      conversation_id = nil
    )
      # Initialize dependencies (can't use initialize with perform_later)
      # Initialize broadcaster first so we can broadcast errors
      broadcaster = ChatBroadcaster.new
      tracker = InteractionTracker.new
      conversation_service = Conversations::ConversationService.new

      Rails.logger.info "[AI_CHAT_JOB] Starting job - session: #{session_id}, query: #{query}, conversation: #{conversation_id}"

      # Track interaction start
      interaction = tracker.track(
        session_id: session_id,
        user_id: user_id,
        space_id: space_id,
        query: query,
      )

      # User message is already added by RagController before enqueuing; do not add again or messages double up.

      # Execute RAG pipeline
      rag_pipeline = Ai::Rag::RagPipeline.new
      result = rag_pipeline.execute(
        query: query,
        space_id: space_id,
        conversation_id: conversation_id,
      )

      # Build metadata for debugging (why AI had or lacked data)
      rag_metadata = build_rag_metadata(result)

      # Broadcast metadata
      broadcaster.metadata(
        conversation_id,
        {
          query_type: result[:analysis]&.dig(:query_type),
          data_sources: result[:analysis]&.dig(:data_sources),
          filters: result[:analysis]&.dig(:filters)
        },
      )

      # Generate streaming response
      accumulated_content = +""
      response_generator = ResponseGenerator.new
      started_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)

      response_generator.generate(
        prompt: result[:prompt],
        conversation_id: conversation_id,
        user_query: query,
        on_chunk: proc do |chunk|
          accumulated_content << chunk
          broadcaster.chunk(conversation_id, accumulated_content.to_s)
        end,
      )

      time_seconds = Process.clock_gettime(Process::CLOCK_MONOTONIC) - started_at

      # Save assistant response
      conversation_service.add_assistant_message(
        conversation_id: conversation_id,
        content: accumulated_content,
        metadata: { query_type: result[:analysis]&.dig(:query_type) },
      )

      # Complete interaction with full RAG context for admin debugging
      broadcaster.complete(conversation_id, accumulated_content)
      interaction&.complete!(
        accumulated_content,
        metadata: rag_metadata,
        enhanced_prompt: result[:prompt],
        time_seconds: time_seconds,
      )

      Rails.logger.info "[AI_CHAT_JOB] Completed successfully"

    rescue StandardError => e
      handle_error(
        error: e,
        tracker: tracker,
        interaction: interaction,
        broadcaster: broadcaster,
        conversation_id: conversation_id,
      )
      raise
    end

    private

    def handle_pipeline_failure(
      result:,
      tracker:,
      interaction:,
      broadcaster:,
      conversation_id:
    )
      error_msg = result.failure.to_s
      Rails.logger.error "[AI_CHAT_JOB] Pipeline failure: #{error_msg}"

      broadcaster&.error(conversation_id, error_msg)
      interaction&.fail!(error_msg)
    end

    def handle_error(
      error:,
      tracker:,
      interaction:,
      broadcaster:,
      conversation_id:
    )
      Rails.logger.error "[AI_CHAT_JOB] #{error.class}: #{error.message}"
      Rails.logger.error error.backtrace.first(5).join("\n")

      broadcaster&.error(conversation_id, error.message)
      interaction&.fail!(error.message)
    end

    def build_rag_metadata(result)
      analysis = result[:analysis]
      structured = result[:structured_data]
      vector = result[:vector_results]

      {
        query_type: analysis&.query_type,
        data_sources: analysis&.data_sources,
        filters: analysis&.filters,
        time_range: analysis&.time_range,
        structured_data_count: Array(structured).size,
        vector_results_count: Array(vector).size
      }.compact
    end
  end
end
