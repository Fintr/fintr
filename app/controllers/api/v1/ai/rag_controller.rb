# frozen_string_literal: true

module Api
  module V1
    module Ai
      class RagController < ApplicationController
        before_action :set_space

        def query
          session_id = SecureRandom.uuid

          operation = ::Ai::Operations::Usages::CreateUsage.new
          .call(
            user_id: current_user.id,
            space_id: @space.id,
            ai_type: "ai_chat",
            tokens_used: 3
          ) do
            # Store initial state in Rails cache
            Rails.cache.write("ai_chat_#{session_id}", {
              status: "processing",
              content: "",
              query: rag_params[:query],
              space_id: @space.id,
              created_at: Time.current
            }, expires_in: 10.minutes)

            # Start background processing
            AiChatJob.perform_later(session_id, rag_params[:query], @space.id, current_user.id)
            true
          end

          return render json: { session_id: session_id, status: "processing" } if operation.success?

          render_internal_server_error(message: "AI chat query processing failed", details: operation.failure)
        end

        def status
          session_id = params[:session_id]
          return render_error(message: "Session ID required", status: :bad_request) unless session_id

          chat_data = Rails.cache.read("ai_chat_#{session_id}")
          return render_error(message: "Session not found", status: :not_found) unless chat_data

          render json: {
            status: chat_data[:status],
            content: chat_data[:content],
            metadata: chat_data[:metadata],
            error: chat_data[:error]
          }
        end

        private

        def set_space
          @space = current_user.spaces.find_by!(code: request.headers["X-Space-Code"])
        end

        def rag_params
          params.permit(:query)
        end

        def render_streaming_response(rag_data)
          Rails.logger.info "[STREAMING] Starting streaming response"

          # Set headers for Server-Sent Events
          response.headers["Content-Type"] = "text/event-stream"
          response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
          response.headers["Connection"] = "keep-alive"
          response.headers["X-Accel-Buffering"] = "no"
          response.headers["Pragma"] = "no-cache"
          response.headers["Expires"] = "0"

          # Calculate metadata for initial send
          metadata = calculate_metadata(rag_data)
          Rails.logger.info "[STREAMING] Sending metadata: #{metadata}"

          # Send initial metadata
          response.stream.write("event: metadata\n")
          response.stream.write("data: #{metadata.to_json}\n\n")
          Rails.logger.info "[STREAMING] Metadata sent"

          # Stream the LLM response in real-time
          stream_llm_response(rag_data[:enhanced_prompt])

          # Send completion signal
          response.stream.write("event: complete\n")
          response.stream.write("data: #{{ "message" => "Stream completed" }.to_json}\n\n")
          Rails.logger.info "[STREAMING] Completion signal sent"
        rescue StandardError => e
          Rails.logger.error "[STREAMING] Error: #{e.message}"
          response.stream.write("event: error\n")
          response.stream.write("data: #{{ "message" => e.message }.to_json}\n\n")
        ensure
          response.stream.close
          Rails.logger.info "[STREAMING] Stream closed"
        end

        def calculate_metadata(rag_data)
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
            query: rag_params[:query],
            confidence: confidence,
            sources: sources
          }
        end

        def stream_llm_response(enhanced_prompt)
          Rails.logger.info "[STREAMING] Starting LLM response stream"
          client = OpenAI::Client.new(access_token: ENV["OPENAI_API_KEY"])

          client.chat(
            parameters: {
              model: "gpt-4",
              messages: [
                { role: "system", content: "You are a helpful financial assistant." },
                { role: "user", content: enhanced_prompt }
              ],
              stream: proc do |chunk, _event|
                if chunk.dig("choices", 0, "delta", "content")
                  content = chunk.dig("choices", 0, "delta", "content")
                  Rails.logger.info "[STREAMING] OpenAI chunk: '#{content}'"
                  response.stream.write("event: content\n")
                  response.stream.write("data: #{{ "content" => content }.to_json}\n\n")
                  Rails.logger.info "[STREAMING] Wrote to stream: '#{content}'"
                  $stdout.flush # Force immediate output
                end
              end,
              temperature: 0.7,
              max_tokens: 2000
            }
          )
          Rails.logger.info "[STREAMING] LLM response stream completed"
        rescue StandardError => e
          Rails.logger.error "[STREAMING] LLM Error: #{e.message}"
          response.stream.write("event: error\n")
          response.stream.write("data: #{{ "message" => "Failed to stream LLM response: #{e.message}" }.to_json}\n\n")
        end
      end
    end
  end
end
