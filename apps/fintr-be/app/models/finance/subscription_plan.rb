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
    validates :price_cents, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :price_currency, presence: true
    validates :interval, presence: true, inclusion: { in: %w[month year] }
    validates :active, inclusion: { in: [true, false] }

    PRO_CATALOG = [
      {
        slug: "pro_monthly",
        name: "Pro Monthly",
        price_cents: 10_000,
        interval: "month",
      },
      {
        slug: "pro_yearly",
        name: "Pro Yearly",
        price_cents: 100_000,
        interval: "year",
      },
    ].freeze

    LEGACY_SLUGS = {
      "pro" => "pro_monthly",
      "pro-yearly" => "pro_yearly",
    }.freeze

    scope :active, -> { where(active: true) }
    scope :by_slug, ->(slug) { where(slug: slug) }

    def self.sync_pro_catalog!
      transaction do
        adopt_legacy_slugs!
        PRO_CATALOG.each do |attributes|
          plan = find_or_initialize_by(slug: attributes[:slug])
          plan.assign_attributes(
            name: attributes[:name],
            price_cents: attributes[:price_cents],
            price_currency: "PHP",
            interval: attributes[:interval],
            active: true,
            description: ProFeatures.description,
          )
          plan.save!
        end

        where.not(slug: catalog_slugs)
          .update_all(active: false, updated_at: Time.current)
      end
    end

    def self.catalog_slugs
      PRO_CATALOG.map { |attributes| attributes[:slug] }
    end

    def self.adopt_legacy_slugs!
      LEGACY_SLUGS.each do |legacy_slug, catalog_slug|
        legacy_plan = find_by(slug: legacy_slug)
        next unless legacy_plan

        catalog_plan = find_by(slug: catalog_slug)
        if catalog_plan.nil?
          legacy_plan.update!(slug: catalog_slug)
          next
        end

        SpaceSubscription.where(subscription_plan_id: legacy_plan.id)
          .update_all(
            subscription_plan_id: catalog_plan.id,
            updated_at: Time.current,
          )
      end
    end
    private_class_method :catalog_slugs, :adopt_legacy_slugs!

    monetize :price_cents, with_model_currency: :price_currency

    def free?
      price_cents.zero?
    end
  end
end
