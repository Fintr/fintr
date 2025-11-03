# frozen_string_literal: true

module Entities
  module Queries
    class AllEntities < BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          optional(:entity_type).maybe(:string)
          optional(:search).maybe(:string)
        end
      end

      def validate
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call
        params_hash = step validate
        relation = Entities::Entity.all
        relation = step by_space(relation, params_hash)
        relation = step by_entity_type(relation, params_hash)
        relation = step by_search(relation, params_hash)
        relation = step order(relation)
        relation
      end

      private

      def by_space(relation, params)
        relation = relation.for_space(params[:space_id])
        Success(relation)
      end

      def by_entity_type(relation, params)
        entity_type = params[:entity_type] || "loan"
        relation = relation.for_type(entity_type)
        Success(relation)
      end

      def by_search(relation, params)
        return Success(relation) if params[:search].blank?

        relation = relation.where("full_name ILIKE ?", "%#{params[:search]}%")
        Success(relation)
      end

      def order(relation)
        relation = relation.order(:full_name)
        Success(relation)
      end
    end
  end
end
