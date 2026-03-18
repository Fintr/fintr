# frozen_string_literal: true

module Ai
  module Rag
    # Performs vector search using embeddings
    class VectorSearcher
      DEFAULT_LIMIT = 20
      DEFAULT_THRESHOLD = 0.7

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
      # @param filters [Hash]
      # @param limit [Integer]
      # @param threshold [Float]
      # @return [Array<Hash>]
      def search(
        query:,
        space_id:,
        filters: {},
        limit: DEFAULT_LIMIT,
        threshold: DEFAULT_THRESHOLD
      )
        query_embedding = generate_embedding(query)

        results = perform_vector_search(
          query_embedding,
          space_id,
          filters,
          limit,
          threshold,
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
        threshold
      )
        scope = build_scope(space_id, filters)

        scope.nearest_neighbors_optimized(
          query_embedding,
          limit: limit,
          threshold: threshold,
        )
      end

      def build_scope(space_id, filters)
        scope = @repository.for_space(space_id)

        if filters[:embeddable_type].present?
          scope = scope.where(embeddable_type: filters[:embeddable_type])
        end

        if filters[:category].present?
          scope = scope.where("metadata->>'category' ILIKE ?", "%#{filters[:category]}%")
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

      def format_results(results)
        results.map do |embedding|
          {
            id: embedding.id,
            embeddable_id: embedding.embeddable_id,
            embeddable_type: embedding.embeddable_type,
            content: embedding.content,
            metadata: embedding.metadata,
            similarity_score: 1 - embedding.neighbor_distance,
            distance: embedding.neighbor_distance
          }
        end
      end
    end

    class EmbeddingError < StandardError; end
  end
end
