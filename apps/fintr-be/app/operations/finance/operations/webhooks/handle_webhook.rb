# frozen_string_literal: true

module Finance
  module Operations
    module Webhooks
      class HandleWebhook < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:payload).value(:hash)
            optional(:webhook_token).maybe(:string)
          end

          rule(:webhook_token) do
            key.failure("webhook token unauthorized") if value.present? && value != ENV["XENDIT_WEBHOOK_TOKEN"]
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params      = step validate(params:)
          _           = step verify_webhook_token(params:)
          event       = step extract_event(params:)
          data        = step extract_data(params:)
          result      = step route_webhook_event(event:, data:)

          result
        end

        private

        def verify_webhook_token(params:)
          return Success(true) unless params[:webhook_token].present?

          if params[:webhook_token] != ENV["XENDIT_WEBHOOK_TOKEN"]
            return Failure(webhook_token: "unauthorized")
          end

          Success(true)
        end

        def extract_event(params:)
          payload = params[:payload].deep_symbolize_keys

          # Try multiple event extraction methods
          event = payload[:event] ||
                  payload[:type] ||
                  payload[:event_type] ||
                  determine_event_from_data(payload:)

          return Failure(event: "missing") unless event.present?

          Success(event)
        end

        def extract_data(params:)
          payload = params[:payload].deep_symbolize_keys

          # If explicit data key exists, use it
          data = if payload[:data].present?
            payload[:data]
          else
            # Otherwise, use the entire payload minus event-related keys
            payload.except(:event, :type, :event_type)
          end

          Success(data)
        end

        def determine_event_from_data(payload:)
          # Try to infer event type from payload structure
          # Check for recurring plan events
          # Xendit sends recurring.plan.activation when status changes to ACTIVE
          if payload[:status] == "ACTIVE" && payload[:id].present?
            # Prefer activation event name (matches Xendit docs)
            return "recurring.plan.activation"
          end
          if payload[:status] == "INACTIVE" && payload[:id].present?
            return "recurring.plan.inactivation"
          end

          # Check for cycle events
          if payload[:cycle].present?
            return "recurring.cycle.succeeded" if payload[:status] == "SUCCEEDED" || payload.dig(:action, :status) == "SUCCEEDED"
            return "recurring.cycle.failed" if payload[:status] == "FAILED" || payload.dig(:action, :status) == "FAILED"
            return "recurring.cycle.retrying" if payload[:status] == "RETRYING"
            return "recurring.cycle.created" if payload.dig(:cycle, :id).present?
          end

          nil
        end

        def route_webhook_event(event:, data:)
          case event
          when "recurring.plan.activation", "recurring.plan.activated"
            Subscriptions::Webhooks::HandlePlanActivated.new.call(data)
          when "recurring.plan.inactivation", "recurring.plan.inactivated"
            Subscriptions::Webhooks::HandlePlanInactivated.new.call(data)
          when "recurring.cycle.created"
            logger.info("recurring.cycle.created event received: #{data.inspect}")
            Subscriptions::Webhooks::HandleCycleCreated.new.call(data)
          when "recurring.cycle.retrying"
            Subscriptions::Webhooks::HandleCycleRetrying.new.call(data)
          when "recurring.cycle.succeeded"
            Subscriptions::Webhooks::HandleCycleSucceeded.new.call(data)
          when "recurring.cycle.failed"
            Subscriptions::Webhooks::HandleCycleFailed.new.call(data)
          when "payment.session.succeeded", "payment.session.completed",
               "payment_session.succeeded", "payment_session.completed"
            PaymentSessions::Webhooks::HandlePaymentSessionSucceeded.new.call(data)
          else
            Failure(event: "Unknown webhook event: #{event}")
          end
        end

        def logger
          Rails.logger.tagged("HandleWebhook")
        end
      end
    end
  end
end
