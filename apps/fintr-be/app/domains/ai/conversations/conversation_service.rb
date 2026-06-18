# frozen_string_literal: true

module Ai
  module Conversations
    # High-level conversation service for persisting chat messages.
    class ConversationService
      def initialize(repository: nil)
        @repository = repository || MessageRepository.new
      end

      def add_user_message(
        conversation_id:,
        content:,
        metadata: {}
      )
        save_message(
          conversation_id: conversation_id,
          role: "user",
          content: content,
          metadata: metadata,
        )
      end

      def add_assistant_message(
        conversation_id:,
        content:,
        metadata: {}
      )
        save_message(
          conversation_id: conversation_id,
          role: "assistant",
          content: content,
          metadata: metadata,
        )
      end

      private

      def save_message(
        conversation_id:,
        role:,
        content:,
        metadata:
      )
        @repository.save(
          conversation_id: conversation_id,
          role: role,
          content: content,
          metadata: metadata,
        )

        update_conversation_timestamp(conversation_id)
      end

      def update_conversation_timestamp(conversation_id)
        Ai::Conversation.find_by(id: conversation_id)
          &.update_last_message_at!
      end
    end
  end
end
