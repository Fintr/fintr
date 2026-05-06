# frozen_string_literal: true

module Finance
  class ReconcileSubscriptionCycleCountsJob < ApplicationJob
    queue_as :default

    def perform
      Rails.logger.info("Starting ReconcileSubscriptionCycleCountsJob")

      current_time = Time.zone.now

      # Use query object to find subscriptions needing updates
      query_result = Finance::Queries::SubscriptionsNeedingCycleCountUpdate.call(
        params: { current_time: current_time }
      )

      return unless query_result.success?

      subscriptions_to_update = query_result.value!

      # Enqueue UpdateSubscriptionCycleCountJob for each subscription
      enqueued_count = enqueue_cycle_count_updates(subscriptions_to_update)

      Rails.logger.info(
        "ReconcileSubscriptionCycleCountsJob completed. Enqueued: #{enqueued_count} subscriptions"
      )
    rescue StandardError => e
      Rails.logger.error(
        "ReconcileSubscriptionCycleCountsJob failed: #{e.message}\n#{e.backtrace.join("\n")}"
      )
      raise
    end

    private

    def enqueue_cycle_count_updates(subscriptions_to_update)
      enqueued_count = 0

      subscriptions_to_update.find_each do |subscription|
        # max_cycle_number comes from the SQL query result (selected field from paid_cycles join)
        max_cycle_number = subscription.max_cycle_number

        # Enqueue job to update cycle count for this subscription
        Finance::UpdateSubscriptionCycleCountJob.perform_later(
          space_subscription_id: subscription.id,
          cycle_number: max_cycle_number
        )

        enqueued_count += 1
        Rails.logger.info(
          "Enqueued cycle count update for subscription #{subscription.id} " \
          "to cycle_number #{max_cycle_number}"
        )
      end

      enqueued_count
    end
  end
end
