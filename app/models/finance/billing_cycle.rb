# frozen_string_literal: true

module Finance
  class BillingCycle < ApplicationRecord
    self.table_name = "finance_billing_cycles"

    belongs_to :space_subscription,
               class_name: "Finance::SpaceSubscription"
    has_many :payments,
             class_name: "Finance::Payment",
             dependent: :nullify

    enum :status, {
      pending: "pending",
      paid: "paid",
      failed: "failed"
    }

    validates :cycle_number,
              presence: true,
              uniqueness: { scope: :space_subscription_id },
              numericality: { greater_than: 0 }
    validates :span, presence: true
    validates :tokens_allocated,
              presence: true,
              numericality: { greater_than: 0 }

    scope :paid, -> { where(status: :paid) }
    # Find cycles where the span contains the current time
    # Using @> operator which checks if range contains the timestamp
    # Note: PostgreSQL tstzrange uses [) bounds by default, but since we use .end_of_day
    # for cycle_end, the range effectively includes the entire end day
    scope :active, -> { where("span @> ?::timestamptz", Time.zone.now) }
    scope :for_subscription, ->(subscription_id) { where(space_subscription_id: subscription_id) }
    scope :current, -> { order(cycle_number: :desc).limit(1) }

    # Helper methods to access span bounds
    def started_at
      span&.begin
    end

    def ends_at
      span&.end
    end

    def expired?
      return true if span.nil?
      ends_at < Time.current
    end

    def active?
      !expired?
    end

    def mark_as_paid!(paid_at: Time.zone.now)
      update!(
        status: "paid",
        paid_at: paid_at
      )
    end
  end
end
