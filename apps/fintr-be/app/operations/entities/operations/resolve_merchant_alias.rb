# frozen_string_literal: true

module Entities
  module Operations
    class ResolveMerchantAlias < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          required(:scanned_name).value(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        step lookup_entity_name(params:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def lookup_entity_name(params:)
        normalized = Entities::MerchantAlias.normalize_name(params[:scanned_name])
        return Success(nil) if normalized.blank?

        alias_record = Entities::MerchantAlias
                       .includes(:entity)
                       .find_by(
                         space_id: params[:space_id],
                         scanned_name: normalized,
                       )
        return Success(nil) unless alias_record

        Success(alias_record.entity.full_name)
      end
    end
  end
end
