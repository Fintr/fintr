# frozen_string_literal: true

module Finance
  class SpaceSubscription < ApplicationRecord
    self.table_name = "finance_space_subscriptions"

    belongs_to :space, class_name: "Spaces::Space"
    belongs_to :subscription_plan, class_name: "Finance::SubscriptionPlan"
    belongs_to :sponsor_code, class_name: "Finance::SponsorCode", optional: true
    has_many :payments,
             class_name: "Finance::Payment",
             foreign_key: :space_subscription_id,
             dependent: :destroy
    has_many :billing_cycles,
             class_name: "Finance::BillingCycle",
             foreign_key: :space_subscription_id,
             dependent: :destroy
    has_one :user_sponsor_code,
            class_name: "Finance::UserSponsorCode",
            dependent: :nullify

    enum :status, {
      requires_action: "requires_action",
      pending: "pending",
      active: "active",
      inactive: "inactive"
    }

    enum :subscription_type, {
      paid: "paid",
      sponsor: "sponsor",
      free: "free"
    }, prefix: :type

    validates :status, presence: true
    validates :subscription_type, presence: true
    validates :current_cycle_count, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :total_cycles, numericality: { greater_than: 0 }, allow_nil: true

    scope :active, -> { where(status: :active) }
    scope :for_space, ->(space_id) { where(space_id: space_id) }
    scope :free, -> { where(subscription_type: :free) }
    scope :paid, -> { where(subscription_type: :paid) }
    scope :sponsor, -> { where(subscription_type: :sponsor) }

    def active?
      status == "active"
    end

    def token_limit
      subscription_plan.token_limit
    end

    def expired?
      ended_at.present? && ended_at < Time.current
    end

    def completed?
      return false if total_cycles.nil?

      current_cycle_count >= total_cycles
    end

    def current_paid_cycle
      billing_cycles.paid.active.order(cycle_number: :desc).first
    end

    def current_failed_cycle
      # Get the most recent failed billing cycle that has an action_url
      # This is the cycle that needs user action to retry payment
      billing_cycles.failed
                    .where.not(action_url: nil)
                    .order(cycle_number: :desc)
                    .first
    end

    def paid_and_active_cycles
      # Return only the current paid cycle (billing cycles should be exclusive, one at a time)
      current_cycle = current_paid_cycle
      return billing_cycles.none unless current_cycle

      billing_cycles.where(id: current_cycle.id)
    end

    def in_grace_period?
      return false if active? # Active subscriptions don't need grace period

      current_paid_cycle.present?
    end

    def effective_token_limit
      if active?
        # Active subscription: FREE_TOKENS + subscription plan tokens
        Spaces::Space::FREE_TOKENS + subscription_plan.token_limit
      elsif in_grace_period?
        # Grace period: FREE_TOKENS + tokens from current paid and active billing cycle
        current_cycle = current_paid_cycle
        return nil unless current_cycle

        Spaces::Space::FREE_TOKENS + current_cycle.tokens_allocated
      else
        nil
      end
    end

    # Returns the end date of the grace period (when the current billing cycle ends)
    # For cancelled subscriptions, returns the end date of the current active billing cycle
    # Returns nil if not cancelled or no active billing cycle
    def grace_period_ends_at
      # If in grace period (has paid active cycles), return the end date of the current paid cycle
      return current_paid_cycle&.ends_at if in_grace_period?

      # If cancelled but not in grace period yet (no paid cycles), return the end date of current active cycle
      if cancelled_at.present? && status == "inactive"
        current_cycle = billing_cycles.active.order(cycle_number: :desc).first
        return current_cycle&.ends_at
      end

      nil
    end

    # Check if a plan change is allowed for this subscription
    # Returns true if the subscription can be updated, false otherwise
    def can_change_plan?
      # Subscription must be active
      return false unless active?

      # Check for failed billing cycles - user must pay for failed cycles before changing plan
      return false if billing_cycles.where(status: :failed).exists?

      # Check if plan change already occurred in current cycle
      # Check metadata for plan_change first (faster check)
      plan_change_metadata = metadata&.dig("plan_change")
      if plan_change_metadata.present? && plan_change_metadata["changed_at"].present?
        changed_at = DateTime.parse(plan_change_metadata["changed_at"])
        current_cycle = current_paid_cycle

        # If there's a current paid cycle and the plan change happened during it, block update
        if current_cycle && changed_at.between?(current_cycle.started_at, current_cycle.ends_at)
          return false
        end

        # If no current cycle but plan change exists, also check for prorated cycles
        unless current_cycle
          existing_prorated = billing_cycles
                                  .where("metadata->>'prorated' = 'true'")
                                  .exists?

          return false if existing_prorated
        end
      end

      # Also check for prorated cycles associated with current cycle
      # Prorated cycles have cycle_number = original_cycle_number + 0.1 (e.g., 1.1, 2.1)
      current_cycle = current_paid_cycle
      if current_cycle
        original_cycle_number = current_cycle.cycle_number
        prorated_cycle_number = (original_cycle_number + 0.1).round(1)

        existing_prorated = billing_cycles
                                .where("metadata->>'prorated' = 'true'")
                                .where(cycle_number: prorated_cycle_number)
                                .exists?

        return false if existing_prorated
      end

      true
    end

    def free_subscription?
      subscription_type == "free"
    end

    def paid_subscription?
      subscription_type == "paid"
    end

    def sponsor_subscription?
      subscription_type == "sponsor"
    end

    def discounted?
      sponsor_code_id.present?
    end
  end
end
