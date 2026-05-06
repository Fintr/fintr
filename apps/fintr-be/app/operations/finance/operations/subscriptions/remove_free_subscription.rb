# frozen_string_literal: true

module Finance
  module Operations
    module Subscriptions
      class RemoveFreeSubscription < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
            required(:removed_by).value(:string)
          end
        end

        include FailureHandler

        def call(params)
          params = step validate(params:)
          space = step find_space(params:)
          free_subscription = step find_active_free_subscription(space:)
          step deactivate_free_subscription(free_subscription:, params:)
        end

        private

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def find_space(params:)
          space = Spaces::Space.find_by(id: params[:space_id])
          return Failure(space_id: "not found") unless space

          Success(space)
        end

        def find_active_free_subscription(space:)
          free_subscription = Finance::SpaceSubscription.find_by(
            space_id: space.id,
            status: "active",
            subscription_type: "free"
          )
          return Failure(subscription: "No active free subscription found for this space.") unless free_subscription

          Success(free_subscription)
        end

        def deactivate_free_subscription(free_subscription:, params:)
          free_subscription.update!(
            status: "inactive",
            ended_at: Time.zone.now,
            cancelled_at: Time.zone.now,
            metadata: free_subscription.metadata.to_h.merge(
              removed_by: params[:removed_by],
              removed_at: Time.zone.now.iso8601,
              removed_by_admin: true
            )
          )

          Success(free_subscription)
        rescue ActiveRecord::RecordInvalid => e
          Failure(subscription: e.record.errors.full_messages)
        rescue StandardError => e
          Failure(error: "Failed to remove free subscription: #{e.message}")
        end
      end
    end
  end
end
