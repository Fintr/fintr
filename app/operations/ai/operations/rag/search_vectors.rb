# frozen_string_literal: true

module Ai
  module Operations
    module Rag
      class SearchVectors < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:query).value(:string)
            required(:space_id).value(:string)
            required(:limit).value(:integer)
            required(:threshold).value(:float)
            optional(:embeddable_type).maybe(:string)
            optional(:filters).maybe(:hash)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params = step validate(params:)
          query_embedding = step generate_query_embedding(params:)
          results = step perform_vector_search(query_embedding:, params:)
          formatted_results = step format_results(results:, params:)
          formatted_results
        end

        private

        def generate_query_embedding(params:)
          client = OpenAI::Client.new(access_token: ENV["OPENAI_API_KEY"])

          response = client.embeddings(
            parameters: {
              model: "text-embedding-ada-002",
              input: params[:query]
            }
          )

          embedding_vector = response.dig("data", 0, "embedding")

          if embedding_vector.nil? || embedding_vector.empty?
            return Failure(embedding_error: "Invalid embedding response from OpenAI")
          end

          Success(embedding_vector)
        rescue StandardError => e
          Failure(embedding_error: "Failed to generate query embedding: #{e.message}")
        end

        def perform_vector_search(query_embedding:, params:)
          scope = Ai::RagEmbedding.for_space(params[:space_id])

          # Filter by embeddable type if specified
          if params[:embeddable_type].present?
            scope = scope.where(embeddable_type: params[:embeddable_type])
          end

          # Apply filters if provided
          if params[:filters].present?
            scope = apply_filters(scope, params[:filters])
          end

          # Use pgvectorscale optimized search for high-performance operations
          results = scope.nearest_neighbors_optimized(
            query_embedding,
            limit: params[:limit] || 10,
            threshold: params[:threshold] || 0.7
          )

          Success(results)
        rescue StandardError => e
          Failure(embedding_error: "Failed to perform vector search: #{e.message}")
        end

        def apply_filters(scope, filters)
          return scope if filters.nil?

          if filters[:embeddable_type].present?
            scope = scope.where(embeddable_type: filters[:embeddable_type])
          end

          if filters[:transaction_type].present?
            scope = scope.where("metadata->>'transaction_type' = ?", filters[:transaction_type])
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

        def format_results(results:, params:)
          formatted_results = results.map do |embedding|
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

          Success({
            query: params[:query],
            results: formatted_results,
            total_count: formatted_results.count,
            space_id: params[:space_id]
          })
        rescue StandardError => e
          Failure(embedding_error: "Failed to format results: #{e.message}")
        end
      end
    end
  end
end
