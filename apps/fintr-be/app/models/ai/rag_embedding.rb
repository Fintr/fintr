# frozen_string_literal: true

module Ai
  class RagEmbedding < ApplicationRecord
    self.table_name = "rag_embeddings"

    belongs_to :embeddable, polymorphic: true
    belongs_to :space, class_name: "Spaces::Space"

    validates :content, presence: true
    validates :embedding, presence: true
    validates :embeddable_type, presence: true
    validates :embeddable_id, presence: true
    validates :embeddable_type, inclusion: { in: ["Transactions::Transaction", "Transactions::Transfer"] }

    scope :for_space, ->(space_id) { where(space_id: space_id) }
    scope :for_transactions, -> { where(embeddable_type: "Transactions::Transaction") }
    scope :for_transfers, -> { where(embeddable_type: "Transactions::Transfer") }

    # Neighbor gem integration with pgvectorscale
    has_neighbors :embedding

    # pgvectorscale specific methods for high-performance operations
    def self.nearest_neighbors_optimized(
      query_vector,
      limit: 50,
      threshold: 0.65,
      candidate_limit: nil
    )
      fetch_limit = candidate_limit || [limit * 5, 100].max

      results = nearest_neighbors(:embedding, query_vector, distance: "cosine")
                .limit(fetch_limit)
                .select { |result| result.neighbor_distance <= threshold }

      results.first(limit)
    end

    def self.batch_similarity_search(query_vectors, limit: 10)
      # Batch processing for multiple queries (useful for bulk operations)
      query_vectors.map do |query_vector|
        nearest_neighbors_optimized(query_vector, limit: limit)
      end
    end

    # Performance monitoring methods
    def self.index_statistics
      # Get HNSW index statistics for monitoring
      connection.execute(<<~SQL)
        SELECT#{' '}
          schemaname,
          tablename,
          indexname,
          pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes#{' '}
        WHERE indexname LIKE '%rag_embeddings%'
        ORDER BY pg_relation_size(indexrelid) DESC;
      SQL
    end

    def self.vector_performance_stats
      # Monitor vector search performance
      connection.execute(<<~SQL)
        SELECT#{' '}
          COUNT(*) as total_embeddings,
          AVG(array_length(embedding, 1)) as avg_dimensions,
          MIN(created_at) as oldest_embedding,
          MAX(created_at) as newest_embedding
        FROM rag_embeddings;
      SQL
    end
  end
end
