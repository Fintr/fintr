# frozen_string_literal: true

module Ai
  class AiChatJob < ApplicationJob
    queue_as :default

    def perform(session_id, query, space_id, user_id, conversation_id = nil)
      Rails.logger.info "[AI_CHAT_JOB] Starting job for session #{session_id}"

      # Create initial interaction record (optional - for admin tracking)
      interaction = nil
      begin
        interaction = Ai::Interaction.create_from_chat_session(
          session_id, user_id, space_id, query
        )
      rescue => e
        Rails.logger.warn "[AI_CHAT_JOB] Could not create interaction record: #{e.message}"
      end

      begin
        start_time = Time.current

        # Get conversation if it exists
        openai_conversation_id = nil
        if conversation_id.present?
          conversation = Ai::Conversation.find(conversation_id)
          openai_conversation_id = conversation.openai_conversation_id
        end

        # Process the RAG query to get context
        rag_result = ::Ai::Operations::Rag::ProcessStreamingRagQuery.new.call(
          query: query,
          space_id: space_id,
          openai_conversation_id:
        )

        if rag_result.failure?
          interaction&.update_with_error(rag_result.failure.to_s)
          update_chat_cache(session_id, {
            status: "error",
            error: rag_result.failure.to_s
          })
          return
        end

        rag_data = rag_result.value!

        # Calculate metadata
        metadata = calculate_metadata(rag_data, query)

        # Update cache with metadata and raw AI analysis
        update_chat_cache(session_id, {
          metadata: metadata,
          raw_ai_analysis: rag_data[:raw_ai_analysis]
        })

        # Stream LLM response with cache updates
        response_content = stream_llm_response_to_cache(
          session_id,
          rag_data[:enhanced_prompt],
          openai_conversation_id,
          user_query: query
        )

        # Calculate tokens and time
        end_time = Time.current
        time_seconds = (end_time - start_time).round(2)

        # Update interaction with response and the actual prompt sent to OpenAI
        interaction&.update_with_response(
          response_content,
          calculate_tokens(response_content),
          time_seconds,
          metadata,
          rag_data[:enhanced_prompt]
        )

        # Save assistant response to conversation if conversation_id is provided
        if conversation_id.present?
          begin
            conversation = Ai::Conversation.find(conversation_id)
            conversation.add_assistant_message(response_content, metadata)

          rescue => e
            Rails.logger.warn "[AI_CHAT_JOB] Could not save to conversation: #{e.message}"
          end
        end

        # Mark as complete
        update_chat_cache(session_id, {
          status: "complete"
        })

      rescue StandardError => e
        Rails.logger.error "[AI_CHAT_JOB] Error: #{e.message}"
        interaction&.update_with_error(e.message)
        update_chat_cache(session_id, {
          status: "error",
          error: e.message
        })
      end
    end

    private

    def update_chat_cache(session_id, updates)
      cache_key = "ai_chat_#{session_id}"
      current_data = Rails.cache.read(cache_key) || {}
      updated_data = current_data.merge(updates)
      Rails.cache.write(cache_key, updated_data, expires_in: 10.minutes)
    end

    def calculate_metadata(rag_data, query)
      structured_data = rag_data[:structured_data]
      search_results = rag_data[:search_results]

      # Calculate confidence based on structured data quality
      confidence = structured_data[:metadata][:total_records] > 0 ? 0.9 : 0.3
      confidence += 0.1 if search_results[:results]&.any?
      confidence = [confidence, 1.0].min

      # Format sources
      sources = []

      # Add structured data source
      if structured_data[:metadata][:total_records] > 0
        sources << {
          id: "structured_data",
          type: "structured_query",
          similarity: 1.0,
          content: "Query: #{structured_data[:query_type]} - #{structured_data[:data_summary]}"
        }
      end

      # Add vector search sources
      search_results[:results]&.each do |result|
        sources << {
          id: result[:id],
          type: result[:embeddable_type],
          similarity: result[:similarity_score],
          content: result[:content][0..100] + "..."
        }
      end

      {
        query: query,
        confidence: confidence,
        sources: sources,
        ai_analysis: {
          query_type: rag_data[:data_requirements][:query_type],
          data_sources: rag_data[:data_requirements][:data_sources],
          time_range: rag_data[:data_requirements][:time_range],
          filters: rag_data[:data_requirements][:filters]
        }
      }
    end

    def stream_llm_response_to_cache(session_id, enhanced_prompt, openai_conversation_id, user_query:)
      client = OpenAI::Client.new(access_token: ENV["OPENAI_API_KEY"])
      accumulated_content = ""

      client.responses.create(
        parameters: {
          model: "gpt-4",
          conversation: { id: openai_conversation_id },
          input: user_query,
          instructions: enhanced_prompt,
          stream: proc do |chunk, _event|
            if chunk.dig("delta")
              content = chunk.dig("delta")
              accumulated_content += content

              # Update cache with new content
              update_chat_cache(session_id, {
                content: accumulated_content,
                status: "streaming"
              })
            end
          end,
          temperature: 0.1,
          max_output_tokens: 2000
        }
      )

      accumulated_content
    rescue StandardError => e
      Rails.logger.error "[AI_CHAT_JOB] LLM Error: #{e.message}"
      update_chat_cache(session_id, {
        status: "error",
        error: "Failed to stream LLM response: #{e.message}"
      })
      raise e
    end

    def calculate_tokens(content)
      # Simple token estimation: roughly 4 characters per token
      # This is a rough approximation - in production you might want to use tiktoken
      (content.length / 4.0).ceil
    end
  end
end
