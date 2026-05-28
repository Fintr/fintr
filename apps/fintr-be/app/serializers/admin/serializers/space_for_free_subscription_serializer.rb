# frozen_string_literal: true

module Admin
  module Serializers
    class SpaceForFreeSubscriptionSerializer < Blueprinter::Base
      identifier :id

      fields :name, :code, :currency

      field :type do |space|
        space.type == "Spaces::PersonalSpace" ? "Personal" : "Organization"
      end

      field :owner_email do |space|
        space.owner&.email
      end

      field :owner_name do |space|
        space.owner&.full_name
      end

      field :transactions_count do |space|
        space.read_attribute(:transactions_count).to_i
      end

      field :has_active_subscription do |space|
        space.space_subscriptions.any? { |subscription| subscription.status == "active" }
      end

      field :subscription_status do |space|
        active_subscription = space.space_subscriptions.find { |s| s.status == "active" }
        active_subscription&.status
      end

      field :subscription_type do |space|
        active_subscription = space.space_subscriptions.find { |s| s.status == "active" }
        active_subscription&.subscription_type
      end

      field :created_at do |space|
        space.created_at.iso8601
      end
    end
  end
end
