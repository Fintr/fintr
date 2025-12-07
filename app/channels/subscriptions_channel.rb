# frozen_string_literal: true

class SubscriptionsChannel < ApplicationCable::Channel
  def subscribed
    # Subscribe to updates for a specific space
    space_id = params[:space_id]

    if space_id.present?
      stream_from "subscriptions:#{space_id}"
      Rails.logger.info("Subscribed to subscriptions channel for space #{space_id}")
    else
      reject
    end
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
    Rails.logger.info("Unsubscribed from subscriptions channel")
  end
end
