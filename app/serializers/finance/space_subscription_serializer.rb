# frozen_string_literal: true

module Finance
  class SpaceSubscriptionSerializer < Blueprinter::Base
    identifier :id

    association :subscription_plan,
                 name: :subscriptionPlan,
                 blueprint: Finance::SubscriptionPlanSerializer
    field :status
    field :started_at, name: :startedAt
    field :ended_at, name: :endedAt
    field :current_cycle_count, name: :currentCycleCount
    field :total_cycles, name: :totalCycles
    field :created_at, name: :createdAt
    field :updated_at, name: :updatedAt

    # Include grace period end date for cancelled subscriptions
    field :grace_period_ends_at, name: :gracePeriodEndsAt do |subscription|
      subscription.grace_period_ends_at&.iso8601
    end

    # Include current failed billing cycle with action_url for retry
    association :current_failed_cycle,
                 name: :currentFailedCycle,
                 blueprint: Finance::BillingCycleSerializer,
                 if: ->(_field_name, subscription, _options) { subscription.current_failed_cycle.present? }

    # Include action URL from metadata for requires_action subscriptions
    field :action_url, name: :actionUrl do |subscription|
      # Extract action URL from metadata (stored by HandlePlanActivated)
      action_url = subscription.metadata&.dig("action_url")
      # Or try to get it from actions array in metadata
      action_url ||= subscription.metadata&.dig("actions", 0, "url")
      action_url ||= subscription.metadata&.dig("actions", 0, "redirect_url")
      action_url
    end

    # Include all billing cycles for the subscription, ordered by cycle_number descending
    association :billing_cycles,
                 name: :billingCycles,
                 blueprint: Finance::BillingCycleSerializer do |subscription|
      subscription.billing_cycles.order(cycle_number: :desc).to_a
    end

    # Include flag indicating if plan change is allowed
    field :can_change_plan, name: :canChangePlan do |subscription|
      subscription.can_change_plan?
    end
  end
end
