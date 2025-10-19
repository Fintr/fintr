# frozen_string_literal: true

module Ai
  module Serializers
    class ConversationWithMessagesSerializer < Blueprinter::Base
      identifier :id

      fields :title,
             :last_message_at,
             :created_at,
             :updated_at

      field :message_count do |conversation|
        conversation.conversation_messages.count
      end

      field :messages do |conversation|
        conversation.messages_chronological.map do |message|
          Ai::Serializers::ConversationMessageSerializer.render_as_hash(message)
        end
      end
    end
  end
end
