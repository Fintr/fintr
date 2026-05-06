# frozen_string_literal: true

module Finance
  module Operations
    module Subscriptions
      module Webhooks
        class HandlePlanInactivated < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:id).value(:string)
            optional(:reference_id).maybe(:string)
            optional(:customer_id).maybe(:string)
            optional(:schedule_id).maybe(:string)
            optional(:schedule).hash do
              optional(:reference_id).maybe(:string)
            end
          end
        end

          def validate(params:)
            contract = Contract.new.call(**params)
            return Failure(contract.errors.to_h) unless contract.success?

            Success(contract.to_h)
          end

          include FailureHandler

          def call(params)
            params = step validate(params:)
            space_subscription = step find_space_subscription(params:)
            update_attrs = step build_update_attributes(params:, space_subscription:)
            _ = step update_subscription(space_subscription:, update_attrs:)

            { message: "Plan inactivated", subscription_id: space_subscription.id }
          end

          private

          def find_space_subscription(params:)
            FindSpaceSubscriptionByXenditId.new.call(xendit_plan_id: params[:id])
          end

          def build_update_attributes(params:, space_subscription:)
            attrs = {
              status: "inactive",
              ended_at: Time.zone.now,
              cancelled_at: Time.zone.now,
              metadata: space_subscription.metadata.merge(params.deep_stringify_keys)
            }

            attrs[:xendit_reference_id] = params[:reference_id] if params[:reference_id].present?

            # Update schedule reference ID from schedule hash or schedule_id
            if params.dig(:schedule, :reference_id).present?
              attrs[:xendit_schedule_reference_id] = params.dig(:schedule, :reference_id)
            elsif params[:schedule_id].present?
              attrs[:metadata] = attrs[:metadata].merge(schedule_id: params[:schedule_id])
            end

            # Store customer_id in metadata if provided
            if params[:customer_id].present?
              attrs[:metadata] = attrs[:metadata].merge(customer_id: params[:customer_id])
            end


            Success(attrs)
          end

          def update_subscription(space_subscription:, update_attrs:)
            space_subscription.update!(update_attrs)
            Success(space_subscription)
          end
        end
      end
    end
  end
end
