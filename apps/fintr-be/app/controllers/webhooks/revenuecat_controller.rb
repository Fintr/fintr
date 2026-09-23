# frozen_string_literal: true

module Webhooks
  class RevenuecatController < ApplicationController
    skip_before_action :authorize

    def create
      operation = ::Finance::Operations::Revenuecat::HandleWebhook.new.call(
        authorization: request.headers["Authorization"],
        payload: webhook_payload,
      )

      if operation.success?
        return render_success(data: operation.value!, message: "Webhook processed")
      end

      if operation.failure.is_a?(Hash) && operation.failure[:unauthorized].present?
        return render_error(message: "Unauthorized", status: :unauthorized)
      end

      Rails.logger.error("RevenueCat webhook failed: #{operation.failure}")
      render_success(
        data: { error: operation.failure },
        message: "Webhook received",
      )
    end

    private

    def webhook_payload
      params.to_unsafe_h.except("controller", "action", "revenuecat")
    end
  end
end
