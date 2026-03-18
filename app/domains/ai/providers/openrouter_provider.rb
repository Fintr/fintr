# frozen_string_literal: true

module Ai
  module Providers
    # OpenRouter provider implementation
    # Uses OpenRouter's unified API with automatic fallback support
    class OpenrouterProvider < BaseProvider
      DEFAULT_MODELS = {
        analysis: "anthropic/claude-3-haiku",
        generation: "openai/gpt-4o-mini",
        complex: "anthropic/claude-3.5-sonnet"
      }.freeze

      def initialize(
        client: nil,
        api_key: nil
      )
        @client = client || initialize_client(api_key)
      end

      def chat(
        messages:,
        model:,
        temperature: 0.3,
        stream: nil,
        **options
      )
        parameters = build_parameters(
          messages,
          model,
          temperature,
          options,
        )

        if stream
          stream_response(parameters, &stream)
        else
          synchronous_response(parameters)
        end
      rescue StandardError => e
        Rails.logger.error "[OpenrouterProvider] Unexpected error: #{e.class}: #{e.message}"
        raise ProviderError, "Provider error: #{e.message}"
      end

      def embeddings(
        text:,
        model: "openai/text-embedding-3-small"
      )
        response = @client.embeddings(
          model: model,
          input: Array(text),
        )

        extract_embeddings(response)
      rescue StandardError => e
        Rails.logger.error "[OpenrouterProvider] Embeddings error: #{e.message}"
        raise ProviderError, "Embedding generation failed: #{e.message}"
      end

      def healthy?
        # Quick health check by listing models
        @client.models.list
        true
      rescue StandardError
        false
      end

      private

      def initialize_client(api_key)
        api_key ||= ENV["OPENROUTER_API_KEY"]
        raise ProviderError, "OpenRouter API key not configured" unless api_key

        # OpenRouter uses OpenAI-compatible client with custom base URL
        OpenAI::Client.new(
          access_token: api_key,
          uri_base: "https://openrouter.ai/api/v1",
          request_timeout: 120,
        )
      end

      def build_parameters(
        messages,
        model,
        temperature,
        options
      )
        {
          model: model,
          messages: format_messages(messages),
          temperature: temperature,
          max_tokens: options[:max_tokens] || 2000
        }.compact
      end

      def format_messages(messages)
        messages.map do |msg|
          {
            role: msg[:role] || msg["role"],
            content: msg[:content] || msg["content"]
          }
        end
      end

      def stream_response(parameters, &stream_callback)
        content = +""

        # ruby-openai expects stream to be a Proc/callable, not stream: true + block
        stream_proc = proc do |chunk|
          delta = extract_delta(chunk)

          if delta
            content << delta
            stream_callback&.call(delta, chunk)
          end
        end

        @client.chat(parameters: parameters.merge(stream: stream_proc))

        { content: content, role: "assistant" }
      end

      def synchronous_response(parameters)
        response = @client.chat(parameters: parameters)

        {
          content: response.dig("choices", 0, "message", "content"),
          role: response.dig("choices", 0, "message", "role") || "assistant"
        }
      end

      def extract_delta(chunk)
        chunk.dig("choices", 0, "delta", "content")
      end

      def extract_embeddings(response)
        data = response["data"]
        return nil unless data

        if data.is_a?(Array)
          data.map { |d| d["embedding"] }
        else
          data["embedding"]
        end
      end
    end
  end
end
