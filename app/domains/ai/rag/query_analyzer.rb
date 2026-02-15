# frozen_string_literal: true

module Ai
  module Rag
    # Analyzes what data is needed for a query (Single Responsibility)
    class QueryAnalyzer
      def initialize(provider: nil, model_selector: nil)
        @provider = provider || Providers::ProviderFactory.create(:openrouter)
        @model_selector = model_selector || Providers::ModelSelector
      end

      def analyze(query:, space_id:, conversation_context: nil)
        prompt = build_prompt(query, space_id, conversation_context)

        response = @provider.chat(
          messages: [{ role: 'user', content: prompt }],
          model: @model_selector.for_analysis,
          temperature: 0.1
        )

        AnalysisResult.new(parse_response(response))
      rescue StandardError => e
        Rails.logger.error "[QUERY_ANALYZER] Error: #{e.message}"
        raise AnalysisError, e.message
      end

      private

      def build_prompt(query, space_id, context)
        Ai::Prompts::PromptService.analysis_prompt(
          query: query,
          space_id: space_id,
          context: context
        )
      end

      def parse_response(response)
        content = response.is_a?(Hash) ? response[:content] : response

        # Extract JSON from response
        json_match = content.to_s.match(/\{.*\}/m)
        return default_analysis if json_match.nil?

        parsed = JSON.parse(json_match[0], symbolize_names: true)
        normalize_analysis(parsed)
      rescue JSON::ParserError
        default_analysis
      end

      def normalize_analysis(parsed)
        {
          query_type: parsed[:query_type] || 'spending_analysis',
          data_sources: Array(parsed[:data_sources]),
          aggregations: parsed[:aggregations] || {},
          filters: parsed[:filters] || {},
          time_range: parsed[:time_range] || { period: 'this_month' },
          sorting: parsed[:sorting] || { field: 'amount', direction: 'desc' },
          limit: [parsed[:limit] || 10, 50].min,
          chart_suggestion: parsed[:chart_suggestion] || { should_include_chart: false }
        }
      end

      def default_analysis
        {
          query_type: 'spending_analysis',
          data_sources: ['transactions'],
          aggregations: { group_by: ['category'], metrics: ['sum', 'count'] },
          filters: { transaction_type: ['expense'] },
          time_range: { period: 'this_month' },
          sorting: { field: 'amount', direction: 'desc' },
          limit: 10,
          chart_suggestion: { should_include_chart: false }
        }
      end
    end

    AnalysisResult = Struct.new(
      :query_type,
      :data_sources,
      :aggregations,
      :filters,
      :time_range,
      :sorting,
      :limit,
      :chart_suggestion,
      :space_id,
      keyword_init: true
    )

    class AnalysisError < StandardError; end
  end
end
