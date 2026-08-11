# frozen_string_literal: true

module Entities
  module Operations
    class CreateEntity < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).filled(:string)
          required(:full_name).filled(:string)
          required(:entity_type).filled(:string)
          optional(:photo)
        end

        rule(:entity_type) do
          unless %w[loan transaction].include?(value)
            key.failure("must be one of: loan, transaction")
          end
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)

        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params = step validate(params:)
        entity = step create_entity(params:)
        step attach_photo(entity:, params:) if params[:photo].present?

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

      def attach_photo(entity:, params:)
        Utils::ActiveStorage.attach_file(
          entity.photo,
          params[:photo],
          entity.space_id,
        )
        Success(entity)
      end
    end
  end
end
