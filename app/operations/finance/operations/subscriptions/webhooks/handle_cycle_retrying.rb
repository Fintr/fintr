# frozen_string_literal: true

module Finance
  module Operations
    module Subscriptions
      module Webhooks
        class HandleCycleRetrying < Dry::Operation
          class Contract < Dry::Validation::Contract
            params do
              required(:plan_id).value(:string)
              required(:id).value(:string) # Cycle ID
              optional(:cycle_number).value(:integer)
              optional(:scheduled_timestamp).maybe(:string)
              optional(:attempt_details).array(:hash)
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
            previous_cycle      = step find_previous_cycle(space_subscription:, cycle_number:) if cycle_number.present? && cycle_number > 1
            return step rerun_operation(params:) if cycle_number.present? && cycle_number > 1 && previous_cycle.blank? && params[:retry_attempt] < 10

            started_at          = step calculate_started_at(previous_cycle:, params:)
            xendit_cycle_id     = params[:id]
            billing_cycle       = step find_or_create_billing_cycle(
                                      space_subscription:,
                                      xendit_cycle_id:,
                                      params:,
                                      started_at:
                                    )
            _                   = step update_billing_cycle_metadata(billing_cycle:, params:)

            { message: "Cycle retrying", billing_cycle_id: billing_cycle.id }
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
            HandleCycleRetrying.new.call(**params, retry_attempt: (params[:retry_attempt] || 0) + 1)
          end

          def find_or_create_billing_cycle(space_subscription:, xendit_cycle_id:, params:, started_at:)
            cycle_number = params[:cycle_number]
            scheduled_timestamp = params[:scheduled_timestamp].present? ? DateTime.parse(params[:scheduled_timestamp]) : nil

            FindOrCreateBillingCycle.new.call(
              space_subscription:,
              xendit_cycle_id:,
              cycle_number:,
              started_at:,
              scheduled_timestamp:,
              metadata: {}
            )
          end

          def update_billing_cycle_metadata(billing_cycle:, params:)
            current_metadata = billing_cycle.metadata || {}
            retry_attempts = current_metadata["retry_attempts"] || []

            # Append the new retry data to the array
            retry_attempts << params.deep_stringify_keys

            # Extract action_url from attempt_details (payment_link.payment_link_url)
            action_url = extract_action_url_from_attempt_details(params[:attempt_details])

            # Mark billing cycle as failed when first retry webhook is received
            # This ensures users see the payment failed status immediately
            update_attrs = {
              metadata: current_metadata.merge("retry_attempts" => retry_attempts),
              status: "failed"
            }

            # Set action_url if found, so users can retry payment
            update_attrs[:action_url] = action_url if action_url.present?

            billing_cycle.update!(update_attrs)
            Success(true)
          rescue ActiveRecord::RecordInvalid => e
            Failure(billing_cycle: e.record.errors.full_messages)
          end

          def extract_action_url_from_attempt_details(attempt_details)
            return nil unless attempt_details.is_a?(Array)

            # Look for payment_link_url in attempt_details
            # The payment link is typically in the most recent attempt with type "PAYMENT_LINK"
            attempt_details.each do |attempt|
              next unless attempt.is_a?(Hash)

              payment_link_url = attempt.dig("payment_link", "payment_link_url") ||
                                attempt.dig(:payment_link, :payment_link_url)
              return payment_link_url if payment_link_url.present?
            end

            nil
          end
        end
      end
    end
  end
end
