# frozen_string_literal: true

module Ai
  module Providers
    class ProviderError < StandardError
    end

    class UnknownProviderError < StandardError
    end

    # Base class for all LLM providers
    # Implements Interface Segregation - small, focused interface
    class BaseProvider
      # Generate a chat completion
      # @param messages [Array<Hash>] Array of message hashes with :role and :content
      # @param model [String] Model identifier
      # @param temperature [Float] Sampling temperature
      # @param stream [Proc, nil] Optional streaming callback
      # @return [Hash] Response hash
      def chat(
        messages:,
        model:,
        temperature: 0.3,
        stream: nil,
        **options
      )
        raise NotImplementedError, "#{self.class} must implement #chat"
      end

      # Generate embeddings for text
      # @param text [String, Array<String>] Text to embed
      # @param model [String] Embedding model
      # @return [Array<Float>, Array<Array<Float>>] Embedding vector(s)
      def embeddings(
        text:,
        model: nil
      )
        raise NotImplementedError, "#{self.class} must implement #embeddings"
      end

      # Check if provider is healthy
      # @return [Boolean]
      def healthy?
        raise NotImplementedError, "#{self.class} must implement #healthy?"
      end

      # Provider name for logging/metrics
      # @return [String]
      def name
        self.class.name.demodulize.gsub("Provider", "").downcase
      end
    end
  end
end
