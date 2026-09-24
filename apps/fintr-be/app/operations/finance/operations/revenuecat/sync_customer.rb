# frozen_string_literal: true

module Finance
  module Operations
    module Revenuecat
      class SyncCustomer < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:user_id).filled(:string)
          end
        end

        def call(params)
          params = step validate(params)
          user = step find_user(params:)
          customer = step fetch_customer(user:)
          subscription = step fetch_subscription(user:, customer:)
          step persist(user:, customer:, subscription:)
        end

        private

        def validate(params)
          result = Contract.new.call(params)
          return Failure(result.errors.to_h) if result.failure?

          Success(result.to_h)
        end

        def find_user(params:)
          user = Auth::User.find_by(id: params[:user_id])
          return Failure(user_id: ["not found"]) unless user

          Success(user)
        end

        def fetch_customer(user:)
          client = Integrations::Revenuecat::Client.new
          Success(client.get_customer(customer_id: user.id))
        rescue Integrations::Revenuecat::NotFound
          Success(nil)
        rescue Integrations::Revenuecat::Error => e
          Failure(revenuecat: e.message)
        end

        def fetch_subscription(user:, customer:)
          return Success(nil) if customer.nil?

          client = Integrations::Revenuecat::Client.new
          payload = client.list_customer_subscriptions(customer_id: user.id)
          items = Array(payload["items"])
          next_page = payload["next_page"]
          pages = 0

          while next_page.present? && pages < 5
            page = client.get(next_page)
            items.concat(Array(page["items"]))
            next_page = page["next_page"]
            pages += 1
          end

          Success(choose_subscription(items))
        rescue Integrations::Revenuecat::NotFound
          Success(nil)
        rescue Integrations::Revenuecat::Error => e
          Failure(revenuecat: e.message)
        end

        def persist(user:, customer:, subscription:)
          access = entitlement_access(customer)
          record = Finance::RevenuecatCustomer.find_or_initialize_by(user_id: user.id)
          record.assign_attributes(
            {
              app_user_id: user.id,
              pro_active: access[:active],
              pro_expires_at: access[:expires_at],
              synced_at: Time.current,
            }.merge(subscription_attributes(subscription)),
          )
          record.save!
          Success(record)
        rescue ActiveRecord::RecordInvalid => e
          Failure(revenuecat_customer: e.record.errors.full_messages)
        end

        def choose_subscription(items)
          giving_access = items.select { |item| item["gives_access"] }
          pool = giving_access.presence || items
          pool.max_by { |item| item["current_period_ends_at"].to_i }
        end

        def subscription_attributes(subscription)
          return cleared_subscription_attributes if subscription.nil?

          {
            revenuecat_subscription_id: subscription["id"],
            store: subscription["store"],
            product_identifier: product_identifier_from(subscription),
            auto_renewal_status: subscription["auto_renewal_status"],
            subscription_status: subscription["status"],
            gives_access: subscription["gives_access"] == true,
            starts_at: expires_at_from(subscription["starts_at"]),
            current_period_ends_at: expires_at_from(subscription["current_period_ends_at"]),
            management_url: subscription["management_url"],
          }
        end

        def cleared_subscription_attributes
          {
            revenuecat_subscription_id: nil,
            store: nil,
            product_identifier: nil,
            auto_renewal_status: nil,
            subscription_status: nil,
            gives_access: false,
            starts_at: nil,
            current_period_ends_at: nil,
            management_url: nil,
          }
        end

        def product_identifier_from(subscription)
          product_id = subscription["product_id"]
          products = entitlement_products(subscription)
          matched = products.find { |product| product["id"] == product_id }
          return matched["store_identifier"] if matched&.dig("store_identifier").present?

          catalog_identifiers = products.filter_map { |product| product["store_identifier"] }.uniq
          plans = catalog_identifiers.select { |slug| Finance::SubscriptionPlan.exists?(slug: slug) }
          return plans.first if plans.one?

          fetch_product_identifier(product_id)
        end

        def fetch_product_identifier(product_id)
          return nil if product_id.blank?

          product = Integrations::Revenuecat::Client.new.get_product(product_id: product_id)
          product["store_identifier"].presence
        rescue Integrations::Revenuecat::Error
          nil
        end

        def entitlement_products(subscription)
          products = []
          Array(subscription.dig("entitlements", "items")).each do |entitlement|
            products.concat(Array(entitlement.dig("products", "items")))
          end
          pending = subscription.dig("pending_changes", "product")
          products << pending if pending.is_a?(Hash)
          products
        end

        def entitlement_access(customer)
          return { active: false, expires_at: nil } if customer.nil?

          items = active_entitlement_items(customer)
          configured_id = ENV["REVENUECAT_PRO_ENTITLEMENT_ID"].presence
          matching = if configured_id
                       items.select { |item| item["entitlement_id"] == configured_id }
          else
                       items
          end
          current = matching.find { |item| entitlement_current?(item) }
          return { active: false, expires_at: nil } unless current

          {
            active: true,
            expires_at: expires_at_from(current["expires_at"]),
          }
        end

        def active_entitlement_items(customer)
          listed = customer["active_entitlements"] || {}
          items = Array(listed["items"])
          next_page = listed["next_page"]
          pages = 0

          while next_page.present? && pages < 5
            page = Integrations::Revenuecat::Client.new.get(next_page)
            items.concat(Array(page["items"]))
            next_page = page["next_page"]
            pages += 1
          end

          items
        end

        def entitlement_current?(item)
          expires_at = expires_at_from(item["expires_at"])
          return true if expires_at.nil?

          expires_at.future?
        end

        def expires_at_from(expires_ms)
          return nil if expires_ms.blank?

          Time.zone.at(expires_ms.to_i / 1000.0)
        end
      end
    end
  end
end
