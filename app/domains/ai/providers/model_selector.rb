# frozen_string_literal: true

module Ai
  module Providers
    # Model selection logic
    # Centralizes model selection based on operation type and complexity
    class ModelSelector
      MODELS = {
        analysis: {
          primary: 'anthropic/claude-3-haiku',
          fallback: 'openai/gpt-4o-mini',
          complex: 'anthropic/claude-3.5-sonnet',
        },
        # Chat over structured data: Gemini and GPT-3.5 are cheaper and sufficient for Q&A; no need for latest flagship.
        generation: {
          primary: 'google/gemini-2.5-flash-lite',
          fallback: 'openai/gpt-3.5-turbo',
          complex: 'google/gemini-2.5-flash-lite',
        },
        embeddings: {
          primary: 'openai/text-embedding-3-small',
        },
      }.freeze

      class << self
        # Select model based on operation type and complexity
        # @param operation [Symbol] :analysis, :generation, :embeddings
        # @param complexity [Symbol] :simple, :normal, :complex
        # @return [String] Model identifier
        def select(
          operation,
          complexity: :normal
        )
          models = MODELS[operation]
          raise ArgumentError, "Unknown operation: #{operation}" unless models

          case complexity
          when :complex
            models[:complex] || models[:primary]
          when :simple
            models[:fallback]
          else
            models[:primary]
          end
        end

        # Convenience methods
        def for_analysis(complexity: :normal)
          select(:analysis, complexity: complexity)
        end

        def for_generation(complexity: :normal)
          select(:generation, complexity: complexity)
        end

        def for_embeddings
          select(:embeddings)
        end

        # Estimate query complexity
        # @param query [String]
        # @return [Symbol] :simple, :normal, :complex
        def estimate_complexity(query)
          return :complex if query.length > 150
          return :complex if query.match?(/\b(compare|trend|analyze|forecast|predict|why|explain)\b/i)
          return :complex if query.count('?') > 1
          return :simple if query.length < 50 && query.match?(/\b(what|how much|show|list)\b/i)

          :normal
        end
      end
    end
  end
end
