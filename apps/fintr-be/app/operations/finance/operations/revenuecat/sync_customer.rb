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
          step persist(user:, customer:)
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

        def persist(user:, customer:)
          access = entitlement_access(customer)
          record = Finance::RevenuecatCustomer.find_or_initialize_by(user_id: user.id)
          record.assign_attributes(
            app_user_id: user.id,
            pro_active: access[:active],
            pro_expires_at: access[:expires_at],
            synced_at: Time.current,
          )
          record.save!
          Success(record)
        rescue ActiveRecord::RecordInvalid => e
          Failure(revenuecat_customer: e.record.errors.full_messages)
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
