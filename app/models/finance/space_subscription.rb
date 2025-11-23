# frozen_string_literal: true

module Finance
  class SpaceSubscription < ApplicationRecord
    self.table_name = "finance_space_subscriptions"

    belongs_to :space, class_name: "Spaces::Space"
    belongs_to :subscription_plan, class_name: "Finance::SubscriptionPlan"
    has_many :payments, class_name: "Finance::Payment", foreign_key: :space_subscription_id, dependent: :destroy

    enum :status, {
      requires_action: "requires_action",
      pending: "pending",
      active: "active",
      inactive: "inactive"
    }

    validates :status, presence: true
    validates :current_cycle_count, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :total_cycles, numericality: { greater_than: 0 }, allow_nil: true

    scope :active, -> { where(status: :active) }
    scope :for_space, ->(space_id) { where(space_id: space_id) }

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
  end
end

