# frozen_string_literal: true

module Entities
  module Operations
    class DeleteMerchantAlias < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          required(:entity_id).value(:string)
          required(:id).value(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        alias_record = step find_alias(params:)
        step destroy_alias(alias_record:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def find_alias(params:)
        alias_record = Entities::MerchantAlias.find_by(
          id: params[:id],
          space_id: params[:space_id],
          entity_id: params[:entity_id],
        )
        return Failure(id: "not found") unless alias_record

        Success(alias_record)
      end

      def destroy_alias(alias_record:)
        alias_record.destroy!
        Success(alias_record)
      rescue ActiveRecord::RecordNotDestroyed => e
        Failure(error: e.message, expected: true)
      end
    end
  end
end
