# frozen_string_literal: true

module Webhooks
  class XenditController < ApplicationController
    # Skip authentication for webhooks - Xendit uses webhook tokens for verification
    skip_before_action :authorize

    def create
      # Xendit sends webhook token in x-callback-token header (case-insensitive)
      webhook_token = request.headers["x-callback-token"] ||
                      request.headers["X-Callback-Token"] ||
                      request.headers["X-CALLBACK-TOKEN"]

      operation = ::Finance::Operations::Webhooks::HandleWebhook.new.call(
        payload: webhook_params,
        webhook_token: webhook_token
      )

      if operation.success?
        # Return 200 OK immediately to acknowledge receipt (prevents Xendit retries)
        render_success(
          data: operation.value!,
          message: "Webhook processed successfully"
        )
      else
        Rails.logger.error("Xendit webhook processing failed: event=#{webhook_params[:event]} error=#{operation.failure}")

        # Check if it's an unauthorized error (invalid token)
        if operation.failure.is_a?(Hash) && operation.failure[:unauthorized].present?
          return render_error(
            message: "Unauthorized",
            status: :unauthorized
          )
        end

        # Check if it's a missing event error
        if operation.failure.is_a?(Hash) && operation.failure[:event].present?
          return render_error(
            message: "Event is required",
            status: :bad_request
          )
        end

        # For other errors, still return 200 to prevent Xendit retries (best practice)
        # but log the error internally
        render_success(
          data: { error: operation.failure },
          message: "Webhook received but processing failed"
        )
      end
    rescue StandardError => e
      Rails.logger.error("Xendit webhook error: #{e.message}\n#{e.backtrace.join("\n")}")
      # Return 200 to prevent Xendit retries, but log the error
      # Xendit best practice: Always return 200 OK to acknowledge receipt
      render_success(
        data: { error: e.message },
        message: "Webhook received but error occurred"
      )
    end

    private

    def webhook_params
      # Permit all params for webhook - Xendit sends various payload structures
      params.permit!.to_h
    end
  end
end
