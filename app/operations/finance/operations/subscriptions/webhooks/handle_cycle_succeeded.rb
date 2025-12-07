# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Finance
  module Operations
    module Subscriptions
      module Webhooks
        class HandleCycleSucceeded < Dry::Operation
          class Contract < Dry::Validation::Contract
            params do
              required(:plan_id).value(:string)
              required(:id).value(:string) # Cycle ID
              required(:cycle_number).value(:integer)
              required(:scheduled_timestamp).value(:string)
              required(:reference_id).value(:string)
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
          include Dry::Operation::Extensions::ActiveRecord

          def call(params)
            transaction do
              params              = step validate(params:)
              space_subscription  = step find_space_subscription(params:)
              cycle_number        = params[:cycle_number]
              previous_cycle      = step find_previous_cycle(space_subscription:, cycle_number:) if cycle_number > 1
              return step rerun_operation(params:) if cycle_number > 1 && previous_cycle.blank? && params[:retry_attempt] < 10

              started_at          = step calculate_started_at(previous_cycle:, params:)
              xendit_cycle_id     = params[:id]
              # Create billing cycle first so we can link payment to it
              billing_cycle       = step find_or_create_billing_cycle(
                                            space_subscription:,
                                            xendit_cycle_id:,
                                            params:,
                                            started_at:
                                          )
              payment             = step find_or_create_payment(
                                            space_subscription:,
                                            billing_cycle:,
                                            xendit_cycle_id:,
                                            params:
                                          )
              _                   = step update_payment_as_succeeded(payment:, params:)
              _                   = step mark_billing_cycle_as_paid(billing_cycle:, payment:)
              _                   = step enqueue_cycle_count_update(space_subscription:, billing_cycle:, params:)

              {
                message: "Cycle succeeded",
                billing_cycle_id: billing_cycle.id,
                payment_id: payment.id
              }
            end
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
            HandleCycleSucceeded.new.call(**params, retry_attempt: (params[:retry_attempt] || 0) + 1)
          end

          def find_or_create_billing_cycle(space_subscription:, xendit_cycle_id:, params:, started_at:)
            cycle_number = params[:cycle_number]
            scheduled_timestamp = DateTime.parse(params[:scheduled_timestamp])

            FindOrCreateBillingCycle.new.call(
              space_subscription:,
              xendit_cycle_id:,
              cycle_number:,
              started_at:,
              scheduled_timestamp:,
              metadata: params.deep_stringify_keys
            )
          end

          def find_or_create_payment(space_subscription:, billing_cycle:, xendit_cycle_id:, params:)
            FindOrCreatePayment.new.call(
              space_subscription:,
              billing_cycle:,
              xendit_cycle_id:,
              **params
            )
          end

          def update_payment_as_succeeded(payment:, params:)
            payment.mark_as_paid!
            Success(payment)
          end

          def mark_billing_cycle_as_paid(billing_cycle:, payment:)
            payment.reload
            # Clear action_url since cycle has succeeded - action_url is only needed for failed cycles
            billing_cycle.update!(
              status: "paid",
              paid_at: payment.paid_at,
              action_url: nil
            )
            Success(billing_cycle)
          end

          def enqueue_cycle_count_update(space_subscription:, billing_cycle:, params:)
            # Extract cycle_number from flat structure
            cycle_number = params[:cycle_number]
            return Success(true) unless cycle_number.present?

            # Only update cycle count if the billing cycle's span contains the current datetime
            # This ensures we only update for the current active cycle, not past or future cycles
            # Check if the span contains the current time using PostgreSQL range operator
            return Success(true) unless billing_cycle.span&.cover?(Time.zone.now)

            # Enqueue job to update cycle count asynchronously
            # This ensures we update the count when the cycle actually succeeds, not when it's created
            Finance::UpdateSubscriptionCycleCountJob.perform_later(
              space_subscription_id: space_subscription.id,
              cycle_number: cycle_number
            )

            Success(true)
          end
        end
      end
    end
  end
end
