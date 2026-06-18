# frozen_string_literal: true

module Ai
  module Rag
    # Resolves transaction IDs via vector similarity for topic searches.
    class SemanticTransactionResolver
      DEFAULT_LIMIT = 50
      DEFAULT_THRESHOLD = 0.65
      DEFAULT_CANDIDATE_LIMIT = 150
      AGGREGATE_LIMIT = 500
      AGGREGATE_CANDIDATE_LIMIT = 1_000

      def initialize(vector_searcher: nil)
        @vector_searcher = vector_searcher || VectorSearcher.new
      end

      def resolve(
        query:,
        space_id:,
        time_range: nil,
        filters: {},
        limit: DEFAULT_LIMIT,
        threshold: DEFAULT_THRESHOLD,
        candidate_limit: DEFAULT_CANDIDATE_LIMIT
      )
        return [] if query.blank?

        search_results(
          query: query,
          space_id: space_id,
          time_range: time_range,
          filters: filters,
          limit: limit,
          threshold: threshold,
          candidate_limit: candidate_limit,
        )
          .then { |results| CategoryConsensusFilter.filter_results(results) }
          .filter_map { |result| transaction_id(result) }
          .uniq
      end

      private

      def search_results(
        query:,
        space_id:,
        time_range:,
        filters:,
        limit:,
        threshold:,
        candidate_limit:
      )
        semantic_query = enrich_semantic_query(query)
        hard_filters = SearchScopeFilters.vector_filters_for(
          time_range: time_range,
          filters: filters,
        )

        @vector_searcher.search(
          query: semantic_query,
          space_id: space_id,
          filters: hard_filters,
          limit: limit,
          threshold: threshold,
          candidate_limit: candidate_limit,
        )
      end

      def transaction_id(result)
        return unless result[:embeddable_type] == "Transactions::Transaction"

        result[:embeddable_id]
      end

      def enrich_semantic_query(query)
        terms = query.to_s.strip.split(/\s+/)
        return query if terms.length > 1

        "#{query} spending"
      end
    end
  end
end
