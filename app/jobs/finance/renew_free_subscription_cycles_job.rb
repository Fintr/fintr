# frozen_string_literal: true

module Finance
  class RenewFreeSubscriptionCyclesJob < ApplicationJob
    queue_as :default

    def perform
      # Find all active free subscriptions that need a new billing cycle
      # (current cycle is ending within the next 3 days)
      # Query for billing cycles where the end of the span is within the renewal window
      renewal_window_start = Time.current
      renewal_window_end = 3.days.from_now

      free_subscriptions = Finance::SpaceSubscription
        .where(subscription_type: "free", status: "active")
        .joins(:billing_cycles)
        .where(
          finance_billing_cycles: {
            status: "paid",
            cycle_number: 1.0 # Only check the first cycle for renewal
          }
        )
        .where("finance_billing_cycles.span @> ?::timestamptz", Time.current) # Current cycle is active
        .where("upper(finance_billing_cycles.span) <= ?", renewal_window_end) # Ends within renewal window
        .where("upper(finance_billing_cycles.span) > ?", renewal_window_start) # Hasn't already ended
        .distinct

      free_subscriptions.find_each do |subscription|
        renew_subscription(subscription)
      end
    end

    private

    def renew_subscription(subscription)
      # Get the current/latest billing cycle
      current_cycle = subscription.billing_cycles.paid.order(cycle_number: :desc).first
      return unless current_cycle

      # Calculate next cycle
      next_cycle_number = current_cycle.cycle_number.to_i + 1
      next_start = current_cycle.ends_at
      next_end = if subscription.subscription_plan.interval == "month"
        next_start + 1.month
      else
        next_start + 1.year
      end

      # Check if next cycle already exists (convert to float for decimal comparison)
      existing = subscription.billing_cycles.find_by(cycle_number: next_cycle_number.to_f)
      return if existing

      # Create new billing cycle
      Finance::BillingCycle.create!(
        space_subscription: subscription,
        cycle_number: next_cycle_number.to_f,
        span: (next_start..next_end),
        status: "paid",
        tokens_allocated: subscription.subscription_plan.token_limit,
        paid_at: Time.zone.now,
        xendit_cycle_id: nil,
        metadata: {
          free_subscription: true,
          auto_renewed: true,
          previous_cycle_id: current_cycle.id,
          created_at: Time.zone.now.iso8601
        }
      )

      # Increment cycle count on subscription
      subscription.increment!(:current_cycle_count)

      Rails.logger.info "Renewed free subscription #{subscription.id} - created cycle #{next_cycle_number}"
    rescue StandardError => e
      Rails.logger.error "Failed to renew free subscription #{subscription.id}: #{e.message}"
    end
  end
end
