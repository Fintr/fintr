# frozen_string_literal: true

module Finance
  module Operations
    module Subscriptions
      class FindSpaceSubscriptionByXenditId < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:xendit_plan_id).value(:string)
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
          space_subscription  = step find_subscription(xendit_plan_id: params[:xendit_plan_id])

          space_subscription
        end

        private

        def find_subscription(xendit_plan_id:)
          space_subscription = Finance::SpaceSubscription.find_by(xendit_plan_id: xendit_plan_id)
          return Failure(space_subscription: "not found for xendit_plan_id: #{xendit_plan_id}") unless space_subscription

          Success(space_subscription)
        end
      end
    end
  end
end
