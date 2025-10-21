# frozen_string_literal: true

module Ai
  module Queries
    class PaginatedMessages < BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          required(:conversation_id).filled(:string)
          optional(:page).maybe(:integer)
          optional(:per_page).maybe(:integer)
        end
      end

      def validate
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call
        validated_params = step validate
        relation = step by_conversation(@relation, params)
        relation = step order_by_created_at_desc(relation, params)
        paginated_relation = step paginate(relation, validated_params)

        paginated_relation
      end
    end
  end
end
