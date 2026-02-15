# frozen_string_literal: true

module Ai
  # Smart model selector that picks the best model based on use case and query characteristics
  # Uses the curated ModelRegistry to select optimal models
  class CuratedModelSelector
    def initialize(registry: ModelRegistry)
      @registry = registry
    end

    # Select the best model for a specific use case
    def select(use_case, query: nil, tier: :auto)
      # If tier is auto, analyze the query to determine optimal tier
      if tier == :auto && query.present?
        tier = determine_tier(query, use_case)
      end

      model = @registry.recommend(use_case, tier: tier)
      
      # Fallback to primary if specific tier not found
      model ||= @registry.recommend(use_case, tier: :primary)
      
      # Final fallback to gpt-4o-mini
      model ||= @registry.get('openai/gpt-4o-mini')
      
      model
    end

    # Get model ID string for API calls
    def model_id(use_case, query: nil, tier: :auto)
      select(use_case, query: query, tier: tier)[:name]
    end

    # Get multiple model options with reasoning
    def select_with_reasoning(use_case, query: nil)
      characteristics = analyze_query(query) if query.present?
      
      options = {}
      
      # Primary recommendation
      options[:primary] = {
        model: select(use_case, tier: :primary),
        reasoning: 'Best balance of quality and cost for this use case'
      }
      
      # Fast option
      if fast = @registry.recommend(use_case, tier: :fast)
        options[:fast] = {
          model: fast,
          reasoning: 'Faster response with slightly lower quality'
        }
      end
      
      # Cost-effective option
      cost_effective = find_cost_effective(use_case)
      if cost_effective && cost_effective != options[:primary][:model]
        options[:cost_effective] = {
          model: cost_effective,
          reasoning: 'Cheaper option with acceptable quality'
        }
      end
      
      # Powerful option for complex queries
      if characteristics && characteristics[:complexity] == :high
        if powerful = @registry.recommend(use_case, tier: :reasoning)
          options[:powerful] = {
            model: powerful,
            reasoning: 'Best quality for complex analysis'
          }
        end
      end
      
      options
    end

    # Estimate cost for a request
    def estimate_request_cost(use_case, query:, estimated_input_tokens: nil, estimated_output_tokens: nil)
      model = select(use_case, query: query)
      
      # Estimate tokens if not provided
      input_tokens = estimated_input_tokens || estimate_tokens(query)
      output_tokens = estimated_output_tokens || estimate_output_tokens(use_case)
      
      cost = @registry.estimate_cost(
        model[:name],
        input_tokens: input_tokens,
        output_tokens: output_tokens
      )
      
      {
        model: model,
        estimated_input_tokens: input_tokens,
        estimated_output_tokens: output_tokens,
        cost: cost
      }
    end

    # Compare models for a use case
    def compare_models(use_case)
      [:primary, :fallback, :fast, :reasoning].filter_map do |tier|
        model = @registry.recommend(use_case, tier: tier)
        next unless model
        
        {
          tier: tier,
          name: model[:name],
          provider: model[:provider],
          cost_input: model[:cost_per_1k_input],
          cost_output: model[:cost_per_1k_output],
          speed: model[:speed],
          quality: model[:quality],
          context: model[:context_window]
        }
      end
    end

    private

    def determine_tier(query, use_case)
      characteristics = analyze_query(query)
      
      case use_case
      when :query_analysis
        # Always use fast models for query analysis
        :primary
      when :response_generation
        if characteristics[:complexity] == :high
          :reasoning
        elsif characteristics[:length] > 500
          # Use primary (GPT-4o) for long queries
          :primary
        else
          :primary
        end
      else
        :primary
      end
    end

    def analyze_query(query)
      return {} unless query.present?
      
      {
        complexity: estimate_complexity(query),
        length: query.length,
        requires_math: query.match?(/\d+\.?\d*\s*[%$]?|calculate|compute|sum|total/i),
        is_comparison: query.match?(/compare|versus|vs|difference between/i),
        is_trend: query.match?(/trend|over time|monthly|weekly|history/i),
        is_followup: query.match?(/^(what about|how about|and |also )/i)
      }
    end

    def estimate_complexity(query)
      score = 0
      score += 2 if query.length > 300
      score += 2 if query.match?(/compare.*and|analyze.*trend|forecast|predict|why.*because/i)
      score += 1 if query.match?(/calculate|compute|sum|average/i)
      score += 1 if query.match?(/breakdown|category|group by/i)
      
      case score
      when 0..1 then :low
      when 2..3 then :medium
      else :high
      end
    end

    def find_cost_effective(use_case)
      # Get all models for this use case and find cheapest good option
      recommendations = @registry::RECOMMENDATIONS[use_case]
      return nil unless recommendations
      
      # Try fast tier first
      if fast_id = recommendations[:fast]
        return @registry.get(fast_id)
      end
      
      # Otherwise use primary
      @registry.recommend(use_case, tier: :primary)
    end

    def estimate_tokens(text)
      # Rough estimate: 4 chars per token on average
      (text.length / 4.0).ceil
    end

    def estimate_output_tokens(use_case)
      case use_case
      when :query_analysis then 200
      when :simple_qa then 300
      when :response_generation then 800
      when :data_analysis then 1000
      when :complex_analysis then 1500
      else 500
      end
    end
  end
end
