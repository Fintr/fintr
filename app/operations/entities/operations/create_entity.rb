# frozen_string_literal: true

module Entities
  module Operations
    class CreateEntity < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).filled(:string)
          required(:full_name).filled(:string)
          required(:entity_type).filled(:string)
        end

        rule(:entity_type) do
          unless %w[loan].include?(value)
            key.failure("must be one of: loan")
          end
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)

        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        _ = step validate(params:)
        entity = step create_entity(params:)

        entity
      end

      def create_entity(params:)
        entity = Entities::Entity.new(params.slice(:space_id, :full_name, :entity_type))
        entity.save!
        Success(entity)
      rescue ActiveRecord::RecordInvalid => e
        # This is an expected failure - user provided invalid data
        Failure(errors: entity.errors.to_hash, error: e, expected: true)
      end
    end
  end
end
