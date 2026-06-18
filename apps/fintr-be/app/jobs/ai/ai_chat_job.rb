# frozen_string_literal: true

module Ai
  # Main job for processing AI chat requests via the agentic RAG pipeline.
  class AiChatJob < ApplicationJob
    queue_as :default

    def perform(
      session_id,
      query,
      space_id,
      user_id,
      conversation_id = nil
    )
      broadcaster = ChatBroadcaster.new
      tracker = InteractionTracker.new
      conversation_service = Conversations::ConversationService.new

      Rails.logger.info "[AI_CHAT_JOB] Starting job - session: #{session_id}, query: #{query}, conversation: #{conversation_id}"

      interaction = tracker.track(
        session_id: session_id,
        user_id: user_id,
        space_id: space_id,
        query: query,
      )

      started_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      accumulated_content = +""
      agent_result = {
        cited_embedding_ids: [],
        steps: [],
        searched: false,
      }

      on_content = lambda do |content|
        accumulated_content.replace(content)
        broadcaster.chunk(conversation_id, accumulated_content.to_s)
      end

      on_step = lambda do |step|
        broadcaster.agent_step(conversation_id, step)
      end

      begin
        agent_result = Rag::Agent::Agent.new.run(
          conversation_id: conversation_id,
          space_id: space_id,
          user_query: query,
          on_content: on_content,
          on_step: on_step,
        )
        accumulated_content.replace(agent_result[:content].to_s)
      rescue StandardError => e
        Rails.logger.error "[AI_CHAT_JOB] Agent run failed: #{e.class} - #{e.message}"
        accumulated_content << if accumulated_content.present?
          "\n\n---\n*[Answer interrupted. Please retry for a complete answer.]*"
        else
          "An error occurred while processing. Please retry."
        end
      end

      rag_metadata = Rag::InteractionMetadataBuilder.for_agentic(agent_result)
      audit_prompt = Rag::InteractionMetadataBuilder.audit_prompt_for_agentic(agent_result)

      broadcaster.metadata(
        conversation_id,
        {
          agentic: true,
          searched: agent_result[:searched],
          steps: agent_result[:steps],
          tool_calls: agent_result[:tool_calls],
        },
      )

      finalize_response(
        conversation_id: conversation_id,
        conversation_service: conversation_service,
        broadcaster: broadcaster,
        interaction: interaction,
        accumulated_content: accumulated_content,
        rag_metadata: rag_metadata,
        enhanced_prompt: audit_prompt.presence,
        started_at: started_at,
      )

      Rails.logger.info "[AI_CHAT_JOB] Completed successfully"
    rescue StandardError => e
      handle_error(
        error: e,
        interaction: interaction,
        broadcaster: broadcaster,
        conversation_id: conversation_id,
      )
      raise
    end

    private

    def finalize_response(
      conversation_id:,
      conversation_service:,
      broadcaster:,
      interaction:,
      accumulated_content:,
      rag_metadata:,
      enhanced_prompt:,
      started_at:
    )
      time_seconds = Process.clock_gettime(Process::CLOCK_MONOTONIC) - started_at
      response_content = accumulated_content.to_s.strip

      if response_content.blank?
        response_content = Rag::Agent::ResponseFallbackBuilder::DEFAULT_MESSAGE
      end

      conversation_service.add_assistant_message(
        conversation_id: conversation_id,
        content: response_content,
        metadata: rag_metadata,
      )

      broadcaster.complete(conversation_id, response_content)
      interaction&.complete!(
        response_content,
        metadata: rag_metadata,
        enhanced_prompt: enhanced_prompt,
        time_seconds: time_seconds,
      )
    end

    def handle_error(
      error:,
      interaction:,
      broadcaster:,
      conversation_id:
    )
      Rails.logger.error "[AI_CHAT_JOB] #{error.class}: #{error.message}"
      Rails.logger.error error.backtrace.first(5).join("\n")

      broadcaster&.error(conversation_id, error.message)
      interaction&.fail!(error.message)
    end
  end
end
