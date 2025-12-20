# frozen_string_literal: true

module Ai
  class AiChatJob < ApplicationJob
    queue_as :default

    def perform(session_id, query, space_id, user_id, conversation_id = nil)
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
          error_message = rag_result.failure.to_s
          broadcast_chat_update(
            conversation_id,
            {
              status: "error",
              error: error_message
            }
          )
          return
        end

        rag_data = rag_result.value!

        # Calculate metadata
        metadata = calculate_metadata(rag_data, query)

        # Broadcast metadata via Action Cable
        broadcast_chat_update(
          conversation_id,
          {
            status: "processing",
            metadata: metadata,
            raw_ai_analysis: rag_data[:raw_ai_analysis]
          }
        )

        # Stream LLM response via Action Cable
        response_content = stream_llm_response(
          rag_data[:enhanced_prompt],
          openai_conversation_id,
          conversation_id: conversation_id,
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
        broadcast_chat_update(
          conversation_id,
          {
            status: "complete",
            content: response_content
          }
        )

      rescue StandardError => e
        Rails.logger.error "[AI_CHAT_JOB] Error: #{e.message}"
        interaction&.update_with_error(e.message)
        broadcast_chat_update(
          conversation_id,
          {
            status: "error",
            error: e.message
          }
        )
      end
    end

    private

    def broadcast_chat_update(conversation_id, data)
      unless conversation_id.present?
        Rails.logger.warn "[AI_CHAT_JOB] Skipping broadcast: conversation_id is nil or empty"
        return
      end

      # Convert symbols to strings for JSON serialization
      serialized_data = data.deep_stringify_keys

      begin
        channel_name = "chat_#{conversation_id}"
        ActionCable.server.broadcast(
          channel_name,
          serialized_data
        )
      rescue => e
        Rails.logger.error "[AI_CHAT_JOB] Broadcast failed: #{e.message}"
        Rails.logger.error e.backtrace.join("\n")
      end
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

    def stream_llm_response(enhanced_prompt, openai_conversation_id, conversation_id:, user_query:)
      client = OpenAI::Client.new(access_token: ENV["OPENAI_API_KEY"])
      accumulated_content = ""
      chunk_count = 0

      begin
        response = client.responses.create(
          parameters: {
            model: "gpt-3.5-turbo",
            conversation: { id: openai_conversation_id },
            input: user_query,
            instructions: enhanced_prompt,
            stream: proc do |chunk, event|
              chunk_count += 1

              # Handle error events
              if event == "error" || chunk["type"] == "error"
                error_info = chunk.dig("error") || chunk
                error_message = error_info["message"] || error_info.to_s
                error_code = error_info["code"] || "unknown_error"

                Rails.logger.error "[AI_CHAT_JOB] OpenAI API Error: #{error_code} - #{error_message}"

                # Broadcast error to frontend
                broadcast_chat_update(
                  conversation_id,
                  {
                    status: "error",
                    error: "AI service error: #{error_message}",
                    error_code: error_code
                  }
                )

                # Stop processing
                return
              end

              # Handle failed response events
              if event == "response.failed" || chunk["type"] == "response.failed"
                error_info = chunk.dig("response", "error") || chunk.dig("error") || {}
                error_message = error_info["message"] || "Response failed"
                error_code = error_info["code"] || "response_failed"

                Rails.logger.error "[AI_CHAT_JOB] Response Failed: #{error_code} - #{error_message}"

                # Broadcast error to frontend
                broadcast_chat_update(
                  conversation_id,
                  {
                    status: "error",
                    error: "AI service error: #{error_message}",
                    error_code: error_code
                  }
                )

                # Stop processing
                return
              end

              # Try multiple possible paths for the content
              content = nil
              if chunk.dig("delta")
                content = chunk.dig("delta")
              elsif chunk.dig("choices", 0, "delta", "content")
                content = chunk.dig("choices", 0, "delta", "content")
              elsif chunk.dig("output", 0, "content", 0, "text")
                content = chunk.dig("output", 0, "content", 0, "text")
              elsif chunk.is_a?(String)
                content = chunk
              end

              if content
                accumulated_content += content

                # Broadcast via Action Cable for real-time updates
                broadcast_chat_update(
                  conversation_id,
                  {
                    status: "streaming",
                    content: accumulated_content
                  }
                )
              else
                # Only log non-error chunks that don't have content
                unless chunk["type"] == "response.in_progress"
                  Rails.logger.debug "[AI_CHAT_JOB] ℹ️ Non-content chunk: #{chunk['type']}"
                end
              end
            end,
            temperature: 0.3,
            max_output_tokens: 2000
          }
        )

        # If no content was accumulated from streaming, check if response has content
        if accumulated_content.empty?
          error_message = "The AI service did not return any content. This may be due to the request being too long or a service error."
          Rails.logger.error "[AI_CHAT_JOB] No content received from AI service"

          broadcast_chat_update(
            conversation_id,
            {
              status: "error",
              error: error_message
            }
          )

          # Try to extract content from response as fallback
          if response.is_a?(Hash)
            accumulated_content = response.dig("output", 0, "content", 0, "text") ||
                                 response.dig("choices", 0, "message", "content") ||
                                 response["content"] ||
                                 ""

            if accumulated_content.present?
              # Broadcast the complete content as streaming (so frontend can display it)
              broadcast_chat_update(
                conversation_id,
                {
                  status: "streaming",
                  content: accumulated_content
                }
              )
            end
          end
        end

      rescue => e
        Rails.logger.error "[AI_CHAT_JOB] Error during streaming: #{e.class}: #{e.message}"
        Rails.logger.error e.backtrace.join("\n")
        raise
      end

      accumulated_content
    rescue StandardError => e
      Rails.logger.error "[AI_CHAT_JOB] LLM Error: #{e.message}"
      error_message = "Failed to stream LLM response: #{e.message}"
      broadcast_chat_update(
        conversation_id,
        {
          status: "error",
          error: error_message
        }
      )
      raise e
    end

    def calculate_tokens(content)
      # Simple token estimation: roughly 4 characters per token
      # This is a rough approximation - in production you might want to use tiktoken
      (content.length / 4.0).ceil
    end
  end
end
