# frozen_string_literal: true

module Ai
  module Embeddings
    class GenerateEmbeddingJob < ApplicationJob
      queue_as :ai_processing

      def perform(embeddable_id:, embeddable_type:, space_id:)
        Ai::Operations::Embeddings::GenerateEmbedding.new.call(
          embeddable_id: embeddable_id,
          embeddable_type: embeddable_type,
          space_id: space_id
        )
      end
    end
  end
end
