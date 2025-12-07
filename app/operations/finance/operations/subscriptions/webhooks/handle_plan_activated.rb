# frozen_string_literal: true

module Finance
  module Operations
    module Subscriptions
      module Webhooks
        class HandlePlanActivated < Dry::Operation
          class Contract < Dry::Validation::Contract
            params do
              required(:id).value(:string)
              optional(:status).maybe(:string)
              optional(:reference_id).maybe(:string)
              optional(:customer_id).maybe(:string)
              optional(:schedule_id).maybe(:string)
              optional(:schedule).hash do
                optional(:reference_id).maybe(:string)
              end
              optional(:action_url).maybe(:string)
              optional(:actions).array(:hash)
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

            { message: "Plan activated", subscription_id: space_subscription.id }
          end

          private

          def find_space_subscription(params:)
            FindSpaceSubscriptionByXenditId.new.call(xendit_plan_id: params[:id])
          end

          def build_update_attributes(params:, space_subscription:)
            # Map Xendit status to our status
            # Even if Xendit sends "SCHEDULED", if the event is "recurring.plan.activated",
            # we should mark it as active in our system
            status = map_xendit_status_to_our_status(params[:status])

            attrs = {
              status: status,
              started_at: Time.current,
              metadata: space_subscription.metadata.merge(params.deep_stringify_keys)
            }

            attrs[:xendit_reference_id] = params[:reference_id] if params[:reference_id].present?

            # Update schedule reference ID from schedule hash or schedule_id
            if params.dig(:schedule, :reference_id).present?
              attrs[:xendit_schedule_reference_id] = params.dig(:schedule, :reference_id)
            elsif params[:schedule_id].present?
              # If schedule_id is provided but not in schedule hash, we can store it in metadata
              attrs[:metadata] = attrs[:metadata].merge(schedule_id: params[:schedule_id])
            end

            # Store customer_id in metadata if provided
            if params[:customer_id].present?
              attrs[:metadata] = attrs[:metadata].merge(customer_id: params[:customer_id])
            end


            # Store action URL if present (for REQUIRES_ACTION status)
            action_url = params[:action_url] || params.dig(:actions, 0, :url)
            if action_url.present?
              attrs[:metadata] = attrs[:metadata].merge(action_url: action_url)
            end

            Success(attrs)
          end

          def map_xendit_status_to_our_status(xendit_status)
            # Map Xendit statuses to our internal statuses
            case xendit_status&.upcase
            when "ACTIVE", "SCHEDULED"
              # SCHEDULED means the plan is active and scheduled for recurring payments
              "active"
            when "INACTIVE", "STOPPED"
              "inactive"
            when "REQUIRES_ACTION"
              "requires_action"
            when "PENDING"
              "pending"
            else
              # Default to active if event is "recurring.plan.activated"
              "active"
            end
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
