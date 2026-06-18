# frozen_string_literal: true

module Ai
  module Rag
    # Performs vector search using embeddings
    class VectorSearcher
      DEFAULT_LIMIT = 30
      DEFAULT_THRESHOLD = 0.65
      DEFAULT_CANDIDATE_LIMIT = 150

      def initialize(
        embedding_generator: nil,
        repository: nil
      )
        @embedding_generator = embedding_generator || Operations::Embeddings::GenerateQueryEmbedding.new
        @repository = repository || Ai::RagEmbedding
      end

      # Search for similar vectors
      # @param query [String]
      # @param space_id [String]
      # @param filters [Hash] hard scope only (date, account, transaction type) — no text prefilters
      # @param limit [Integer] max results returned after ranking
      # @param threshold [Float]
      # @param candidate_limit [Integer] neighbors fetched before threshold/limit trimming
      # @return [Array<Hash>]
      def search(
        query:,
        space_id:,
        filters: {},
        limit: DEFAULT_LIMIT,
        threshold: DEFAULT_THRESHOLD,
        candidate_limit: DEFAULT_CANDIDATE_LIMIT
      )
        query_embedding = generate_embedding(query)

        results = perform_vector_search(
          query_embedding,
          space_id,
          filters,
          limit,
          threshold,
          candidate_limit,
        )

        format_results(results)
      rescue StandardError => e
        Rails.logger.error "[VectorSearcher] Error: #{e.message}"
        []
      end

      private

      def generate_embedding(query)
        result = @embedding_generator.call(query: query)
        raise EmbeddingError, "Failed to generate embedding" if result.failure?

        result.value!
      end

      def perform_vector_search(
        query_embedding,
        space_id,
        filters,
        limit,
        threshold,
        candidate_limit
      )
        scope = build_scope(space_id, filters)

        scope.nearest_neighbors_optimized(
          query_embedding,
          limit: limit,
          threshold: threshold,
          candidate_limit: candidate_limit,
        )
      end

      def build_scope(space_id, filters)
        scope = @repository.for_space(space_id)

        if filters[:embeddable_type].present?
          scope = scope.where(embeddable_type: filters[:embeddable_type])
        end

        if filters[:transaction_type].present?
          type = transaction_type_class(filters[:transaction_type])
          scope = scope.where("metadata->>'transaction_type' = ?", type) if type
        end

        if filters[:category].present?
          scope = CategoryFilter.apply_to_embeddings(
            scope,
            category_name: filters[:category],
          )
        end

        if filters[:account].present?
          scope = scope.where("metadata->>'account' ILIKE ?", "%#{filters[:account]}%")
        end

        if filters[:date_from].present?
          scope = scope.where("metadata->>'date' >= ?", filters[:date_from])
        end

        if filters[:date_to].present?
          scope = scope.where("metadata->>'date' <= ?", filters[:date_to])
        end

        scope
      end

      def transaction_type_class(type)
        case type.to_s
        when "expense" then "Transactions::Expense"
        when "income" then "Transactions::Income"
        when "transfer" then "Transactions::Transfer"
        end
      end

      def format_results(results)
        results.map do |embedding|
          {
            id: embedding.id,
            embeddable_id: embedding.embeddable_id,
            embeddable_type: embedding.embeddable_type,
            content: embedding.content,
            metadata: embedding.metadata,
            similarity_score: 1 - embedding.neighbor_distance,
            distance: embedding.neighbor_distance,
          }
        end
      end
    end

    class EmbeddingError < StandardError; end
  end
end
