# frozen_string_literal: true

module Finance
  class SubscriptionPlan < ApplicationRecord
    self.table_name = "finance_subscription_plans"

    has_many :space_subscriptions,
             class_name: "Finance::SpaceSubscription",
             foreign_key: :subscription_plan_id,
             dependent: :restrict_with_error

    validates :name, presence: true
    validates :slug, presence: true, uniqueness: true
    validates :token_limit, presence: true, numericality: { greater_than: 0 }
    validates :price_cents, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :price_currency, presence: true
    validates :interval, presence: true, inclusion: { in: %w[month year] }
    validates :active, inclusion: { in: [true, false] }

    scope :active, -> { where(active: true) }
    scope :by_slug, ->(slug) { where(slug: slug) }

    monetize :price_cents, with_model_currency: :price_currency

    def free?
      price_cents.zero?
    end
  end
end

