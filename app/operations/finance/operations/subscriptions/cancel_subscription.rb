# frozen_string_literal: true

module Finance
  module Operations
    module Subscriptions
      class CancelSubscription < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
            required(:subscription_id).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params              = step validate(params:)
          space               = step find_space(params:)
          space_subscription  = step find_space_subscription(params:, space:)
          _                   = step validate_subscription_can_be_cancelled(space_subscription:)
          xendit_response     = step deactivate_xendit_subscription(space_subscription:)
          _                   = step update_space_subscription(space_subscription:, xendit_response:)

          space_subscription.reload
        end

        private

        def find_space(params:)
          space = Spaces::Space.find_by(id: params[:space_id])
          return Failure(space_id: "not found") unless space

          Success(space)
        end

        def find_space_subscription(params:, space:)
          space_subscription = Finance::SpaceSubscription.find_by(
            id: params[:subscription_id],
            space_id: space.id
          )
          return Failure(subscription_id: "not found") unless space_subscription

          Success(space_subscription)
        end

        def validate_subscription_can_be_cancelled(space_subscription:)
          return Failure(subscription: "already inactive") if space_subscription.status == "inactive"

          Success(true)
        end

        def deactivate_xendit_subscription(space_subscription:)
          client = Integrations::Payments::Xendit::Client.new

          response = client.deactivate_subscription_plan(plan_id: space_subscription.xendit_plan_id)

          Success(response)
        rescue Integrations::Payments::Xendit::Error => e
          return Success(ineligible_deactivation: true) if e.code == "INELIGIBLE_DEACTIVATION"

          Failure(xendit_error: e.message, status: e.status, code: e.code)
        rescue StandardError => e
          Failure(error: "Failed to deactivate Xendit subscription: #{e.message}")
        end

        def update_space_subscription(space_subscription:, xendit_response:)
          # When cancelling, set cancelled_at but don't set ended_at to Time.current
          # The subscription will end when the current paid billing cycle ends (grace period)
          # ended_at will be set when the grace period expires (via webhook or job)
          space_subscription.update!(
            status: "inactive",
            cancelled_at: Time.zone.now,
            metadata: space_subscription.metadata.merge(xendit_response)
          )

          Success(space_subscription)
        rescue ActiveRecord::RecordInvalid => e
          Failure(space_subscription: e.record.errors.full_messages)
        rescue StandardError => e
          Failure(error: "Failed to update space subscription: #{e.message}")
        end
      end
    end
  end
end
