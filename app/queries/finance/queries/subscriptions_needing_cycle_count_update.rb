# frozen_string_literal: true

module Finance
  module Queries
    class SubscriptionsNeedingCycleCountUpdate < BaseQuery
      def initialize(relation: Finance::SpaceSubscription.all, params: {})
        super(relation:, params:)
      end

      def call
        relation = step join_paid_cycles(@relation)
        relation = step where_needs_update(relation)
        relation = step select_fields(relation)
        relation
      end

      private

      def join_paid_cycles(relation)
        current_time = params[:current_time] || Time.zone.now

        # Use a subquery to get the max cycle number for each subscription
        # that has paid billing cycles coinciding with current timestamp
        subquery_sql = ActiveRecord::Base.sanitize_sql_array([
          "SELECT
            space_subscription_id,
            MAX(cycle_number) as max_cycle_number
          FROM finance_billing_cycles
          WHERE status = 'paid'
            AND span @> ?::timestamptz
            AND cycle_number IS NOT NULL
          GROUP BY space_subscription_id",
          current_time
        ])

        result = relation.joins(
          "INNER JOIN (#{subquery_sql}) AS paid_cycles ON " \
          "paid_cycles.space_subscription_id = finance_space_subscriptions.id"
        )

        Success(result)
      rescue StandardError => e
        Failure(error: "Failed to join paid cycles: #{e.message}")
      end

      def where_needs_update(relation)
        # Filter to only include subscriptions where current_cycle_count
        # is NULL or less than the paid cycle's max_cycle_number
        result = relation.where(
          "(finance_space_subscriptions.current_cycle_count IS NULL " \
          "OR paid_cycles.max_cycle_number > finance_space_subscriptions.current_cycle_count)"
        )

        Success(result)
      rescue StandardError => e
        Failure(error: "Failed to filter subscriptions: #{e.message}")
      end

      def select_fields(relation)
        # Select subscription fields and the max_cycle_number from the join
        result = relation.select(
          "finance_space_subscriptions.*",
          "paid_cycles.max_cycle_number"
        )

        Success(result)
      rescue StandardError => e
        Failure(error: "Failed to select fields: #{e.message}")
      end
    end
  end
end
