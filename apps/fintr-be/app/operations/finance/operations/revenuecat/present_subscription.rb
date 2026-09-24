# frozen_string_literal: true

module Finance
  module Operations
    module Revenuecat
      # Maps the stored RevenueCat subscription onto the same card payload as a
      # Xendit space subscription. Apple and Google cancellations stay in the
      # store, so this payload carries the management URL instead of a Xendit cancel.
      class PresentSubscription < Dry::Operation
        CANCELLED_RENEWAL = %w[will_not_renew will_pause].freeze

        class Contract < Dry::Validation::Contract
          params do
            required(:user_id).filled(:string)
          end
        end

        def call(params)
          params = step validate(params)
          record = step find_record(params:)
          plan = step find_plan(record:)
          payload(record:, plan:)
        end

        private

        def validate(params)
          result = Contract.new.call(params)
          return Failure(result.errors.to_h) if result.failure?

          Success(result.to_h)
        end

        def find_record(params:)
          Success(Finance::RevenuecatCustomer.find_by(user_id: params[:user_id]))
        end

        def find_plan(record:)
          return Success(nil) if record.nil? || record.product_identifier.blank?

          Success(Finance::SubscriptionPlan.find_by(slug: record.product_identifier))
        end

        def payload(record:, plan:)
          return nil if record.nil? || plan.nil? || record.revenuecat_subscription_id.blank?

          ends_at = record.current_period_ends_at
          {
            id: record.id,
            provider: "revenuecat",
            store: record.store,
            management_url: record.management_url,
            status: card_status(record),
            subscription_type: "paid",
            started_at: record.starts_at&.iso8601,
            ended_at: record.gives_access? ? nil : ends_at&.iso8601,
            grace_period_ends_at: grace_period_ends_at(record)&.iso8601,
            current_cycle_count: current_cycle_count(record:, plan:),
            total_cycles: nil,
            can_change_plan: false,
            is_discounted: false,
            created_at: record.created_at&.iso8601,
            updated_at: record.updated_at&.iso8601,
            subscription_plan: Finance::SubscriptionPlanSerializer.render_as_hash(plan),
            billing_cycles: [
              {
                id: record.revenuecat_subscription_id,
                cycle_number: current_cycle_count(record:, plan:),
                status: "paid",
                started_at: record.starts_at&.iso8601,
                ends_at: ends_at&.iso8601,
              },
            ],
          }
        end

        def card_status(record)
          return "inactive" unless record.gives_access?
          return "inactive" if CANCELLED_RENEWAL.include?(record.auto_renewal_status)

          "active"
        end

        def grace_period_ends_at(record)
          return nil unless record.gives_access?
          return nil unless CANCELLED_RENEWAL.include?(record.auto_renewal_status)

          record.current_period_ends_at
        end

        def current_cycle_count(record:, plan:)
          return 1 if record.starts_at.blank?

          elapsed_months = ((Time.current.year * 12) + Time.current.month) -
            ((record.starts_at.year * 12) + record.starts_at.month)
          interval_months = plan.interval == "year" ? 12 : 1
          [((elapsed_months / interval_months) + 1), 1].max
        end
      end
    end
  end
end
