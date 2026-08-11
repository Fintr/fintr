# frozen_string_literal: true

module Transactions
  module Operations
    class ResolveTagAssignment < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          required(:tag_ids).array(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        step resolve_tags(params:)
      end

      private

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def resolve_tags(params:)
        tag_ids = params[:tag_ids].uniq
        return Success([]) if tag_ids.empty?

        tags = Transactions::Tag.where(space_id: params[:space_id], id: tag_ids)
        if tags.count != tag_ids.length
          return Failure(tag_ids: "not found")
        end

        Success(tags.to_a)
      end
    end
  end
end
