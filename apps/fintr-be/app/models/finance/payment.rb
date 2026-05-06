# frozen_string_literal: true

module Finance
  class Payment < ApplicationRecord
    self.table_name = "finance_payments"

    belongs_to :space_subscription, class_name: "Finance::SpaceSubscription"
    belongs_to :billing_cycle,
               class_name: "Finance::BillingCycle",
               foreign_key: "biling_cycle_id"

    enum :status, {
      pending: "pending",
      succeeded: "succeeded",
      failed: "failed",
      refunded: "refunded"
    }

    monetize :amount_cents, with_model_currency: :amount_currency

    validates :xendit_cycle_id, presence: true, uniqueness: true
    validates :amount_cents, presence: true, numericality: { greater_than: 0 }
    validates :amount_currency, presence: true
    validates :status, presence: true

    scope :succeeded, -> { where(status: :succeeded) }
    scope :failed, -> { where(status: :failed) }
    scope :pending, -> { where(status: :pending) }
    scope :for_subscription, ->(subscription_id) { where(space_subscription_id: subscription_id) }
    scope :by_date_range, ->(start_date, end_date) { where(paid_at: start_date..end_date) }
    scope :recent, -> { order(paid_at: :desc, created_at: :desc) }

    def space
      space_subscription.space
    end

    def subscription_plan
      space_subscription.subscription_plan
    end

    def mark_as_paid!(paid_at: Time.zone.now)
      update!(
        status: "succeeded",
        paid_at:
      )
    end
  end
end
