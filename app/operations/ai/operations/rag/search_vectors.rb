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
            optional(:sort_by_amount).maybe(:bool)
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
          Ai::Operations::Embeddings::GenerateQueryEmbedding.new.call(
            query: params[:query]
          )
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
            limit: params[:limit],
            threshold: params[:threshold]
          )

          Success(results)
        rescue StandardError => e
          Failure(embedding_error: "Failed to perform vector search: #{e.message}")
        end

        def apply_filters(scope, filters)
          return scope if filters.nil?

          if filters[:embeddable_type].present?
            scope = scope.where(embeddable_type: type_hash[filters[:embeddable_type]])
          end

          if filters[:transaction_type].present?
            scope = scope.where("metadata->>'transaction_type' = ?", type_hash[filters[:transaction_type]])
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

        def type_hash
          @type_hash ||= {
            "expense" => "Transactions::Expense",
            "income" => "Transactions::Income",
            "transfer" => "Transactions::Transfer"
          }
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

          # Sort by amount if requested (for "biggest expense" type queries)
          if params[:sort_by_amount]
            formatted_results = sort_by_amount(formatted_results)
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

        def sort_by_amount(results)
          results.sort_by do |result|
            # Extract amount from metadata - try different possible keys
            amount_cents = extract_amount_from_metadata(result[:metadata])
            # Sort descending (highest first), so negate the value
            -amount_cents
          end
        end

        def extract_amount_from_metadata(metadata)
          return 0 unless metadata.is_a?(Hash)

          # Normalize keys to symbols for consistent access
          normalized_metadata = metadata.deep_symbolize_keys

          # Try to get amount_display first (handles negative for expenses correctly)
          # Then fall back to amount, then amount_cents
          amount_value = normalized_metadata[:amount_display] ||
                        normalized_metadata["amount_display"] ||
                        normalized_metadata[:amount] ||
                        normalized_metadata["amount"] ||
                        normalized_metadata[:amount_cents] ||
                        normalized_metadata["amount_cents"] ||
                        0

          # Convert to numeric if it's a string
          if amount_value.is_a?(String)
            # Remove currency symbols and parse
            numeric_value = amount_value.gsub(/[^\d.-]/, "").to_f
            amount_value = numeric_value
          end

          # For expenses, we want to sort by absolute value (biggest expenses first)
          # amount_display is already negative for expenses, so we'll use absolute value
          amount_value.to_f.abs
        end
      end
    end
  end
end
