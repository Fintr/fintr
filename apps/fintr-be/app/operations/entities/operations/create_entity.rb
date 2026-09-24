# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Entities
  module Operations
    class CreateEntity < Dry::Operation
      include Dry::Operation::Extensions::ActiveRecord

      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).filled(:string)
          required(:full_name).filled(:string)
          required(:entity_type).filled(:string)
          optional(:id).maybe(:string)
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
        transaction do
          entity = step create_entity(params:)
          step attach_photo(entity:, params:)
        end
      end

      def create_entity(params:)
        entity = Entities::Entity.new(params.slice(:space_id, :full_name, :entity_type, :id))
        entity.save!
        Success(entity)
      rescue ActiveRecord::RecordInvalid => e
        # This is an expected failure - user provided invalid data
        Failure(errors: entity.errors.to_hash, error: e, expected: true)
      end

      def attach_photo(entity:, params:)
        return Success(entity) if params[:photo].blank?

        Utils::ActiveStorage.attach_file(
          entity.photo,
          params[:photo],
          entity.space_id,
        )
        Success(entity)
      rescue StandardError => e
        Failure(photo: e.message)
      end
    end
  end
end
