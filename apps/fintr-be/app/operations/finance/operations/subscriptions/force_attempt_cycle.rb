# frozen_string_literal: true

module Finance
  module Operations
    module Subscriptions
      class ForceAttemptCycle < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
            required(:billing_cycle_id).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          return Failure(environment: "Force attempt is only available in development or staging") unless allowed_environment?

          params              = step validate(params:)
          space               = step find_space(params:)
          billing_cycle       = step find_billing_cycle(params:, space:)
          space_subscription  = step find_space_subscription(billing_cycle:)
          _                   = step validate_cycle_status(billing_cycle:)
          result              = step force_attempt(
                                    plan_id: space_subscription.xendit_plan_id,
                                    cycle_id: billing_cycle.xendit_cycle_id
                                  )

          Success(result)
        end

        private

        def allowed_environment?
          Rails.env.development? || Rails.env.staging?
        end

        def find_space(params:)
          space = Spaces::Space.find_by(id: params[:space_id])
          return Failure(space_id: "not found") unless space

          Success(space)
        end

        def find_billing_cycle(params:, space:)
          billing_cycle = Finance::BillingCycle
                          .joins(:space_subscription)
                          .where(id: params[:billing_cycle_id])
                          .where(finance_space_subscriptions: { space_id: space.id })
                          .first

          return Failure(billing_cycle_id: "not found") unless billing_cycle

          Success(billing_cycle)
        end

        def find_space_subscription(billing_cycle:)
          Success(billing_cycle.space_subscription)
        end

        def validate_cycle_status(billing_cycle:)
          return Failure(cycle_status: "Cycle must have xendit_cycle_id to force attempt") unless billing_cycle.xendit_cycle_id.present?

          Success(true)
        end

        def force_attempt(plan_id:, cycle_id:)
          client = Integrations::Payments::Xendit::Client.new
          response = client.force_attempt_cycle(
            plan_id:,
            cycle_id:
          )

          Success(response)
        rescue Integrations::Payments::Xendit::Error => e
          Failure(xendit_error: e.message, status: e.status, code: e.code)
        rescue StandardError => e
          Failure(error: "Failed to force attempt cycle: #{e.message}")
        end
      end
    end
  end
end
