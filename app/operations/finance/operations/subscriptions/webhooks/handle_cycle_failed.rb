# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Finance
  module Operations
    module Subscriptions
      module Webhooks
        class HandleCycleFailed < Dry::Operation
          class Contract < Dry::Validation::Contract
            params do
              required(:plan_id).value(:string)
              required(:id).value(:string) # Cycle ID
              required(:cycle_number).value(:integer)
              required(:reference_id).value(:string)
              optional(:scheduled_timestamp).maybe(:string)
              optional(:failure_reason).maybe(:string)
              required(:actions).array(:hash) do
                required(:url).value(:string)
              end
              optional(:action_url).maybe(:string)
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
              billing_cycle       = step find_or_create_billing_cycle(
                                          space_subscription:,
                                          xendit_cycle_id:,
                                          params:,
                                          started_at:
                                        )

              if xendit_cycle_id.present? && billing_cycle.present?
                payment          = step find_or_create_payment(
                                          space_subscription:,
                                          billing_cycle:,
                                          xendit_cycle_id:,
                                          params:
                                        )
                _                = step mark_payment_as_failed(payment:, params:)
              end

              _                  = step mark_billing_cycle_as_failed(billing_cycle:, params:) if billing_cycle.present?

              { message: "Cycle failed", subscription_id: space_subscription.id }
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
            HandleCycleFailed.new.call(**params, retry_attempt: (params[:retry_attempt] || 0) + 1)
          end

          def find_or_create_payment(space_subscription:, billing_cycle:, xendit_cycle_id:, params:)
            FindOrCreatePayment.new.call(
              space_subscription:,
              billing_cycle:,
              xendit_cycle_id:,
              **params
            )
          end

          def mark_payment_as_failed(payment:, params:)
            payment.update!(
              status: "failed",
              failed_at: Time.current,
              failure_reason: params[:failure_reason] || "Payment failed",
              xendit_data: params,
              metadata: payment.metadata.merge(cycle_data: params)
            )
            Success(payment)
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
              metadata: params.deep_stringify_keys
            )
          end

          def mark_billing_cycle_as_failed(billing_cycle:, params:)
            action_url = params.dig(:actions, 0, :url)
            update_attrs = { status: "failed" }
            update_attrs[:action_url] = action_url if action_url.present?

            billing_cycle.update!(update_attrs)
            Success(billing_cycle)
          end
        end
      end
    end
  end
end
