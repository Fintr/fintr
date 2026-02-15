# frozen_string_literal: true

module Ai
  # Generates AI responses with conversation context
  # Single Responsibility: Response generation
  class ResponseGenerator
    def initialize(
      provider: nil,
      model_selector: nil,
      conversation_service: nil
    )
      @provider = provider || Providers::ProviderFactory.create(:openrouter)
      @model_selector = model_selector || Providers::ModelSelector
      @conversation_service = conversation_service || Conversations::ConversationService.new
    end

    # Generate response with streaming support
    # @param prompt [String] System prompt
    # @param conversation_id [String, nil]
    # @param on_chunk [Proc, nil] Streaming callback
    # @param user_query [String] Current user query for context
    # @return [String] Full response content
    def generate(
      prompt:,
      conversation_id: nil,
      on_chunk: nil,
      user_query: nil
    )
      messages = build_messages(
        prompt: prompt,
        conversation_id: conversation_id,
        user_query: user_query,
      )

      model = @model_selector.for_generation
      content = +""

      @provider.chat(
        messages: messages,
        model: model,
        temperature: 0.3,
        stream: on_chunk ? build_stream_callback(on_chunk, content) : nil,
      )

      content
    rescue StandardError => e
      Rails.logger.error "[ResponseGenerator] Error: #{e.message}"
      raise
    end

    private

    def build_messages(
      prompt:,
      conversation_id:,
      user_query:
    )
      @conversation_service.build_context(
        conversation_id: conversation_id,
        system_prompt: prompt,
        user_query: user_query || "",
      )
    end

    def build_stream_callback(
      on_chunk,
      accumulated_content
    )
      proc do |chunk, _|
        text = extract_text(chunk)
        if text.present?
          accumulated_content << text
          on_chunk.call(text)
        end
      end
    end

    def extract_text(chunk)
      return chunk if chunk.is_a?(String)

      chunk.dig('choices', 0, 'delta', 'content') ||
        chunk.dig('choices', 0, 'message', 'content')
    end
  end
end
