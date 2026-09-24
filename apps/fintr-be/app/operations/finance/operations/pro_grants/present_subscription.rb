# frozen_string_literal: true

module Finance
  module Operations
    module ProGrants
      # Maps a complimentary year onto the same card as a paid subscription.
      # The year ends on expires_at and does not renew.
      class PresentSubscription < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:user_id).filled(:string)
          end
        end

        def call(params)
          params = step validate(params)
          grant = step find_grant(params:)
          payload(grant:)
        end

        private

        def validate(params)
          result = Contract.new.call(params)
          return Failure(result.errors.to_h) if result.failure?

          Success(result.to_h)
        end

        def find_grant(params:)
          Success(Finance::ProGrant.find_by(user_id: params[:user_id]))
        end

        def payload(grant:)
          return nil unless grant&.current?

          {
            id: grant.id,
            provider: "grant",
            status: "active",
            subscription_type: "grant",
            started_at: grant.created_at&.iso8601,
            ended_at: grant.expires_at.iso8601,
            grace_period_ends_at: nil,
            current_cycle_count: 1,
            total_cycles: 1,
            can_change_plan: false,
            is_discounted: false,
            created_at: grant.created_at&.iso8601,
            updated_at: grant.updated_at&.iso8601,
            subscription_plan: {
              id: grant.id,
              name: "Fintr Pro",
              slug: "pro_grant",
              description: "Included for one year. This does not renew.",
              price_cents: 0,
              price_currency: "PHP",
              interval: "year",
              active: true,
            },
            billing_cycles: [
              {
                id: grant.id,
                cycle_number: 1,
                status: "paid",
                started_at: grant.created_at&.iso8601,
                ends_at: grant.expires_at.iso8601,
              },
            ],
          }
        end
      end
    end
  end
end
