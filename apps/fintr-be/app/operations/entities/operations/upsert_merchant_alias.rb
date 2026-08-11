# frozen_string_literal: true

module Entities
  module Operations
    class UpsertMerchantAlias < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          required(:scanned_name).value(:string)
          required(:entity_id).value(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        entity = step find_entity(params:)
        step upsert_alias(params:, entity:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def find_entity(params:)
        entity = Entities::Entity.find_by(
          id: params[:entity_id],
          space_id: params[:space_id],
          entity_type: "transaction",
        )
        return Failure(entity_id: "not found") unless entity

        Success(entity)
      end

      def upsert_alias(params:, entity:)
        normalized = Entities::MerchantAlias.normalize_name(params[:scanned_name])
        return Success(nil) if normalized.blank?

        entity_normalized = Entities::MerchantAlias.normalize_name(entity.full_name)
        return Success(nil) if normalized == entity_normalized

        alias_record = Entities::MerchantAlias.find_or_initialize_by(
          space_id: params[:space_id],
          scanned_name: normalized,
        )
        alias_record.label = params[:scanned_name].to_s.strip.presence || normalized
        alias_record.entity = entity
        alias_record.save!

        Success(alias_record)
      rescue ActiveRecord::RecordInvalid => e
        Failure(errors: e.record.errors.to_hash, error: e, expected: true)
      end
    end
  end
end
