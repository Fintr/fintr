# frozen_string_literal: true

module Finance
  class SpaceSubscriptionSerializer < Blueprinter::Base
    identifier :id

    association :subscription_plan,
                 name: :subscriptionPlan,
                 blueprint: Finance::SubscriptionPlanSerializer
    field :status
    field :subscription_type, name: :subscriptionType
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

    # Include sponsor/discount information if subscription used a sponsor code
    field :is_discounted, name: :isDiscounted do |subscription|
      subscription.discounted?
    end

    field :sponsor_code, name: :sponsorCode do |subscription|
      if subscription.sponsor_code
        {
          code: subscription.sponsor_code.code,
          name: subscription.sponsor_code.name,
          discountPercentage: subscription.user_sponsor_code&.discount_percentage_applied,
          discountAmountCents: subscription.user_sponsor_code&.discount_amount_cents_applied
        }
      end
    end

    # For free subscriptions, include info about who granted it and cycle details
    field :free_subscription_info, name: :freeSubscriptionInfo do |subscription|
      if subscription.free_subscription?
        current_cycle = subscription.billing_cycles.paid.order(cycle_number: :desc).first

        {
          grantedBy: subscription.metadata&.dig("granted_by"),
          grantedAt: subscription.metadata&.dig("granted_at"),
          notes: subscription.metadata&.dig("notes"),
          spaceName: subscription.space.name,
          spaceType: subscription.space.type == "Spaces::PersonalSpace" ? "Personal" : "Organization",
          currentCycle: current_cycle ? {
            cycleNumber: current_cycle.cycle_number,
            startedAt: current_cycle.started_at,
            endsAt: current_cycle.ends_at,
            tokensAllocated: current_cycle.tokens_allocated
          } : nil,
          totalCycles: subscription.billing_cycles.paid.count,
          autoRenews: true
        }
      end
    end
  end
end
