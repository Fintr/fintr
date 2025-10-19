# frozen_string_literal: true

module Ai
  module Serializers
    class ConversationSerializer < Blueprinter::Base
      identifier :id

      fields :title,
             :last_message_at,
             :created_at,
             :updated_at

      field :message_count do |conversation|
        conversation.conversation_messages.count
      end
    end
  end
end
