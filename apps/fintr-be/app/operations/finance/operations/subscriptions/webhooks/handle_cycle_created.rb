# frozen_string_literal: true

module Finance
  module Operations
    module Subscriptions
      module Webhooks
        class HandleCycleCreated < Dry::Operation
          class Contract < Dry::Validation::Contract
            params do
              required(:plan_id).value(:string)
              required(:id).value(:string) # Cycle ID
              required(:cycle_number).value(:integer)
              optional(:scheduled_timestamp).maybe(:string)
              optional(:retry_attempt).maybe(:integer)
            end
          end

          def validate(params:)
            contract = Contract.new.call(**params)
            return Failure(contract.errors.to_h) unless contract.success?

            params = contract.to_h
            params[:retry_attempt] ||= 0
            Success(params)
          end

          include FailureHandler

          def call(params)
            params              = step validate(params:)
            space_subscription  = step find_space_subscription(params:)
            cycle_number        = params[:cycle_number]
            previous_cycle      = step find_previous_cycle(space_subscription:, cycle_number:) if cycle_number > 1
            return step rerun_operation(params:) if cycle_number > 1 && previous_cycle.blank? && params[:retry_attempt] < 10

            started_at          = step calculate_started_at(previous_cycle:, params:)
            billing_cycle       = step create_billing_cycle(space_subscription:, params:, started_at:)

            { message: "Cycle created", billing_cycle_id: billing_cycle.id }
          end

          private

          def find_space_subscription(params:)
            FindSpaceSubscriptionByXenditId.new.call(xendit_plan_id: params[:plan_id])
          end

          def find_previous_cycle(space_subscription:, cycle_number:)
            Rails.logger.info("Finding previous cycle for cycle number: #{cycle_number}")
            previous_cycle = space_subscription.billing_cycles.reload.where(cycle_number: cycle_number - 1).first
            Rails.logger.info("Previous cycle: #{previous_cycle&.id}")
            Success(previous_cycle)
          end

          def calculate_started_at(previous_cycle:, params:)
            started_at = (params[:scheduled_timestamp].present? ? DateTime.parse(params[:scheduled_timestamp]) : Time.zone.now.to_datetime) if previous_cycle.blank?
            started_at ||= (previous_cycle.span.end + 1.second).to_datetime
            Success(started_at)
          end

          def rerun_operation(params:)
            sleep 0.3
            HandleCycleCreated.new.call(**params, retry_attempt: (params[:retry_attempt] || 0) + 1)
          end

          def create_billing_cycle(space_subscription:, params:, started_at:)
            scheduled_timestamp = params[:scheduled_timestamp].present? ? DateTime.parse(params[:scheduled_timestamp]) : nil

            CreateBillingCycle.new.call(
              space_subscription_id: space_subscription.id,
              cycle_number: params[:cycle_number],
              started_at: started_at,
              cycle: params,
              xendit_cycle_id: params[:id],
              scheduled_timestamp: scheduled_timestamp,
              metadata: params.deep_stringify_keys
            )
          end
        end
      end
    end
  end
end
