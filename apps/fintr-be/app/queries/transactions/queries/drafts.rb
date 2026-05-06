# frozen_string_literal: true

module Transactions
  module Queries
    class Drafts < BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).value(:string)
          required(:space_id).value(:string)
        end
      end

      def initialize(relation: Transactions::Draft.all, params: {})
        super(relation:, params:)
      end

      def call
        relation = step where(relation: @relation, params:)
        relation = step order(relation:)
        relation
      end

      def where(relation:, params:)
        relation = relation.where(
          user_id: params[:user_id],
          space_id: params[:space_id]
        )
        Success(relation)
      end

      def order(relation:)
        Success(relation.ordered)
      end
    end
  end
end
