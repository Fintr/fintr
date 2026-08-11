# frozen_string_literal: true

module Entities
  module Operations
    class SearchEntityPhotos < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          required(:id).value(:string)
          optional(:full_name).maybe(:string)
          optional(:prompt).maybe(:string, max_size?: 500)
        end
      end

      def call(params)
        params = step validate(params:)
        entity = step find_entity(params:)
        merchant_name = params[:full_name].presence || entity.full_name
        candidates = step search_candidates(
          merchant_name:,
          prompt: params[:prompt],
        )

        { candidates: }
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def find_entity(params:)
        entity = Entities::Entity.find_by(
          id: params[:id],
          space_id: params[:space_id],
        )
        return Failure(id: "not found") unless entity

        Success(entity)
      end

      def search_candidates(merchant_name:, prompt:)
        candidates = Entities::MerchantImageFinder.find_all(
          merchant_name:,
          search_hints: [prompt].compact,
        )

        Success(candidates)
      end
    end
  end
end
