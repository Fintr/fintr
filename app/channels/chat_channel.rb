# frozen_string_literal: true

class ChatChannel < ApplicationCable::Channel
  def subscribed
    conversation_id = params[:conversation_id]
    Rails.logger.info "[ChatChannel] 📡 Subscription attempt for conversation_id: #{conversation_id}"
    Rails.logger.info "[ChatChannel] Current user: #{current_user&.id}"
    Rails.logger.info "[ChatChannel] Params: #{params.inspect}"

    unless conversation_id.present?
      Rails.logger.error "[ChatChannel] ⛔ Rejecting: conversation_id is missing"
      reject
      return
    end

    stream_from "chat_#{conversation_id}"
    Rails.logger.info "[ChatChannel] ✅ Successfully subscribed to chat_#{conversation_id}"
  end

  def unsubscribed
    Rails.logger.info "[ChatChannel] 👋 Unsubscribed from chat channel"
  end
end
