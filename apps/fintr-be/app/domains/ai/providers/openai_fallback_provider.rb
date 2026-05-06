# frozen_string_literal: true

module Ai
  module Providers
    # Fallback provider using direct OpenAI API
    # Used when OpenRouter fails or for specific features
    class OpenaiFallbackProvider < BaseProvider
      DEFAULT_MODEL = "gpt-4o-mini"

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
      rescue OpenAI::Error => e
        Rails.logger.error "[OpenaiFallbackProvider] OpenAI error: #{e.message}"
        raise ProviderError, "OpenAI error: #{e.message}"
      rescue StandardError => e
        Rails.logger.error "[OpenaiFallbackProvider] Error: #{e.class}: #{e.message}"
        raise ProviderError, "Provider error: #{e.message}"
      end

      def embeddings(
        text:,
        model: "text-embedding-3-small"
      )
        response = @client.embeddings(
          parameters: {
            model: model,
            input: Array(text)
          },
        )

        extract_embeddings(response)
      rescue StandardError => e
        Rails.logger.error "[OpenaiFallbackProvider] Embeddings error: #{e.message}"
        raise ProviderError, "Embedding generation failed: #{e.message}"
      end

      def healthy?
        @client.models.list
        true
      rescue StandardError
        false
      end

      private

      def initialize_client(api_key)
        api_key ||= ENV["OPENAI_API_KEY"]
        raise ProviderError, "OpenAI API key not configured" unless api_key

        OpenAI::Client.new(
          access_token: api_key,
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
          model: model || DEFAULT_MODEL,
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
