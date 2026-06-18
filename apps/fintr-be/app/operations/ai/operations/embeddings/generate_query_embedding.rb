# frozen_string_literal: true

module Ai
  module Operations
    module Embeddings
      class GenerateQueryEmbedding < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:query).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params = step validate(params:)
          embedding = step generate_embedding_vector(params:)
          embedding
        end

        private

        def generate_embedding_vector(params:)
          client = OpenAI::Client.new(access_token: ENV["OPENAI_API_KEY"])
          embedding_model = Rails.configuration.x.llm.embedding_model

          response = client.embeddings(
            parameters: {
              model: embedding_model,
              input: params[:query]
            }
          )

          embedding_vector = response.dig("data", 0, "embedding")
          Success(embedding_vector)
        rescue StandardError => e
          Failure(embedding_error: "Failed to generate query embedding: #{e.message}")
        end
      end
    end
  end
end
