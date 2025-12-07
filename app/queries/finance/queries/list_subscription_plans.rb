# frozen_string_literal: true

module Finance
  module Queries
    class ListSubscriptionPlans < BaseQuery
      def initialize(relation: Finance::SubscriptionPlan.active, params: {})
        super(relation:, params:)
      end

      def call
        relation = step order_by_price(@relation)
        relation
      end

      private

      def order_by_price(relation)
        Success(relation.order(price_cents: :asc))
      rescue StandardError => e
        Failure(error: "Failed to order subscription plans: #{e.message}")
      end
    end
  end
end
