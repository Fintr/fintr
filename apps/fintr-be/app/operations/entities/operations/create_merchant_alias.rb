# frozen_string_literal: true

module Entities
  module Operations
    class CreateMerchantAlias < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          required(:entity_id).value(:string)
          required(:label).value(:string)
        end

        rule(:label) do
          key.failure("must be filled") if value.to_s.strip.blank?
        end
      end

      def call(params)
        params = step validate(params:)
        alias_record = step upsert_alias(params:)

        alias_record
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def upsert_alias(params:)
        result = UpsertMerchantAlias.new.call(
          space_id: params[:space_id],
          entity_id: params[:entity_id],
          scanned_name: params[:label],
        )
        return result if result.failure?

        if result.value!.nil?
          return Failure(
            label: ["cannot be the same as the merchant name"],
          )
        end

        Success(result.value!)
      end
    end
  end
end
