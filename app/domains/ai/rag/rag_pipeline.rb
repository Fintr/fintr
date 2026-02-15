# frozen_string_literal: true

module Ai
  module Rag
    # Orchestrates the RAG flow (Single Responsibility)
    class RagPipeline
      def initialize(
        analyzer: nil,
        retriever: nil,
        searcher: nil,
        prompt_builder: nil
      )
        @analyzer = analyzer || QueryAnalyzer.new
        @retriever = retriever || DataRetriever.new
        @searcher = searcher || VectorSearcher.new
        @prompt_builder = prompt_builder || Ai::Prompts::Builders::RagPromptBuilder.new
      end

      def execute(query:, space_id:, conversation_id: nil)
        # Step 1: Analyze query
        analysis = @analyzer.analyze(
          query: query,
          space_id: space_id,
          conversation_context: load_context(conversation_id)
        )
        # DataRetriever/QueryBuilder need space_id to load transactions (analysis from LLM doesn't include it)
        analysis = with_space_id(analysis, space_id)

        # Step 2: Retrieve structured data
        structured_data = @retriever.retrieve(analysis)

        # Step 3: Vector search
        vector_results = @searcher.search(
          query: query,
          space_id: space_id,
          filters: analysis.filters
        )

        # Step 4: Build enhanced prompt
        prompt = @prompt_builder.build(
          query: query,
          analysis: analysis,
          structured_data: structured_data,
          vector_results: vector_results,
          conversation_id: conversation_id
        )

        {
          prompt: prompt,
          analysis: analysis,
          structured_data: structured_data,
          vector_results: vector_results
        }
      rescue StandardError => e
        Rails.logger.error "[RAG_PIPELINE] Error: #{e.message}"
        raise
      end

      private

      def with_space_id(analysis, space_id)
        return analysis if analysis.respond_to?(:space_id) && analysis.space_id.present?

        attrs = analysis.to_h.slice(
          :query_type,
          :data_sources,
          :aggregations,
          :filters,
          :time_range,
          :sorting,
          :limit,
          :chart_suggestion,
        )
        # Use analysis.class to avoid NameError on Ai::Rag::QueryAnalyzer::AnalysisResult (autoloading)
        analysis.class.new(**attrs.merge(space_id: space_id))
      end

      def load_context(conversation_id)
        return nil unless conversation_id

        Conversations::ContextBuilder.new(conversation_id: conversation_id)
          .load_recent_context
      end
    end
  end
end
