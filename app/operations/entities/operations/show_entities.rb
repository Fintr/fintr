# frozen_string_literal: true

module Entities
  module Operations
    class ShowEntities < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          optional(:entity_type).value(:string)
          optional(:search).value(:string)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params = step validate(params:)
        entities = step get_entities(params:)

        entities
      end

      private

      def get_entities(params:)
        query = ::Entities::Queries::AllEntities.new(params:).call

        Success(query.value!)
      rescue StandardError => e
        Failure(error: e)
      end
    end
  end
end
