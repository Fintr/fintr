# frozen_string_literal: true

module Finance
  class UpdateSubscriptionCycleCountJob < ApplicationJob
    queue_as :default

    def perform(space_subscription_id:, cycle_number:)
      space_subscription = Finance::SpaceSubscription.find_by(id: space_subscription_id)
      return unless space_subscription

      # Only update if the new cycle number is greater than the current one
      # This ensures we don't accidentally decrease the cycle count
      if cycle_number.present? && (space_subscription.current_cycle_count.nil? || cycle_number > space_subscription.current_cycle_count)
        space_subscription.update!(current_cycle_count: cycle_number)
        Rails.logger.info("Updated cycle count for subscription #{space_subscription_id} to #{cycle_number}")
      else
        Rails.logger.info("Skipped cycle count update for subscription #{space_subscription_id}: cycle_number #{cycle_number} is not greater than current #{space_subscription.current_cycle_count}")
      end
    rescue StandardError => e
      Rails.logger.error("Failed to update cycle count for subscription #{space_subscription_id}: #{e.message}\n#{e.backtrace.join("\n")}")
      raise
    end
  end
end
