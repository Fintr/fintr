# frozen_string_literal: true

module Ai
  module Queries
    class BaseQuery < BaseQuery
      def initialize(relation: Ai::ConversationMessage.all, params: {})
        super(relation:, params:)
      end

      private

      def by_conversation(relation, params)
        return Failure(conversation_id: "Required") unless params[:conversation_id].present?

        Success(relation.where(conversation_id: params[:conversation_id]))
      end

      def order_by_created_at_desc(relation, params)
        Success(relation.order(created_at: :asc))
      end
    end
  end
end
