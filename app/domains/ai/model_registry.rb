# frozen_string_literal: true

module Ai
  # Registry of curated models for different use cases
  class ModelRegistry
    FAST_MODELS = {
      'openai/gpt-4o-mini' => {
        name: 'GPT-4o Mini',
        provider: :openrouter,
        cost_per_1k_tokens: 0.15,
        speed: :fast,
        quality: :good,
        best_for: [:simple_queries, :high_volume],
      },
      'anthropic/claude-3-haiku' => {
        name: 'Claude 3 Haiku',
        provider: :openrouter,
        cost_per_1k_tokens: 0.25,
        speed: :fast,
        quality: :good,
        best_for: [:simple_queries, :safety_critical],
      },
    }.freeze

    BALANCED_MODELS = {
      'openai/gpt-4o' => {
        name: 'GPT-4o',
        provider: :openrouter,
        cost_per_1k_tokens: 5.00,
        speed: :medium,
        quality: :excellent,
        best_for: [:general_use, :complex_analysis, :rag],
      },
      'anthropic/claude-3-sonnet' => {
        name: 'Claude 3 Sonnet',
        provider: :openrouter,
        cost_per_1k_tokens: 3.00,
        speed: :medium,
        quality: :excellent,
        best_for: [:complex_analysis, :safety_critical],
      },
    }.freeze

    POWERFUL_MODELS = {
      'anthropic/claude-3-opus' => {
        name: 'Claude 3 Opus',
        provider: :openrouter,
        cost_per_1k_tokens: 15.00,
        speed: :slow,
        quality: :exceptional,
        best_for: [:complex_reasoning, :research],
      },
    }.freeze

    USE_CASE_RECOMMENDATIONS = {
      query_analysis: {
        primary: 'anthropic/claude-3-haiku',
        fallback: 'openai/gpt-4o-mini',
      },
      response_generation: {
        primary: 'openai/gpt-4o',
        fallback: 'anthropic/claude-3-sonnet',
      },
      data_analysis: {
        primary: 'openai/gpt-4o',
        fallback: 'anthropic/claude-3-sonnet',
      },
      embeddings: {
        primary: 'openai/text-embedding-3-small',
      },
    }.freeze

    class << self
      # Get model details by ID
      # @param model_id [String]
      # @return [Hash, nil]
      def get(model_id)
        all_models[model_id]
      end

      # Recommend model for a use case
      # @param use_case [Symbol]
      # @param tier [Symbol] :primary, :fallback
      # @return [Hash, nil]
      def recommend(
        use_case,
        tier: :primary
      )
        recommendation = USE_CASE_RECOMMENDATIONS[use_case]
        return nil unless recommendation

        model_id = recommendation[tier]
        get(model_id)
      end

      # List all available models
      # @return [Hash]
      def list
        all_models
      end

      # Get models by category
      # @param category [Symbol] :fast, :balanced, :powerful
      # @return [Hash]
      def by_category(category)
        case category
        when :fast
          FAST_MODELS
        when :balanced
          BALANCED_MODELS
        when :powerful
          POWERFUL_MODELS
        else
          {}
        end
      end

      private

      def all_models
        @all_models ||= FAST_MODELS.merge(BALANCED_MODELS).merge(POWERFUL_MODELS)
      end
    end
  end
end
