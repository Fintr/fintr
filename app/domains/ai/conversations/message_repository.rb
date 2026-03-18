# frozen_string_literal: true

module Ai
  module Conversations
    # Repository for conversation message persistence
    # Single Responsibility: Database access for conversation messages
    class MessageRepository
      def initialize(model: nil)
        @model = model || Ai::ConversationMessage
      end

      # Get recent messages for a conversation
      # @param conversation_id [String]
      # @param limit [Integer] Maximum number of messages
      # @return [Array<Hash>] Serialized messages
      def recent_messages(
        conversation_id,
        limit:
      )
        @model.where(conversation_id: conversation_id)
              .order(:created_at)
              .last(limit)
              .map { |msg| serialize(msg) }
      end

      # Save a new message
      # @param conversation_id [String]
      # @param role [String] 'user', 'assistant', or 'system'
      # @param content [String] Message content
      # @param metadata [Hash] Additional metadata
      # @return [Ai::ConversationMessage] Saved message
      def save(
        conversation_id:,
        role:,
        content:,
        metadata: {}
      )
        @model.create!(
          conversation_id: conversation_id,
          openai_role: role,
          content: content,
          metadata: metadata,
        )
      end

      # Count total messages in a conversation
      # @param conversation_id [String]
      # @return [Integer]
      def count(conversation_id)
        @model.where(conversation_id: conversation_id).count
      end

      # Get messages by role
      # @param conversation_id [String]
      # @param role [String]
      # @return [Array<Hash>]
      def by_role(
        conversation_id,
        role
      )
        @model.where(
          conversation_id: conversation_id,
          openai_role: role,
        )
              .order(:created_at)
              .map { |msg| serialize(msg) }
      end

      # Get the last message in a conversation
      # @param conversation_id [String]
      # @return [Hash, nil]
      def last_message(conversation_id)
        msg = @model.where(conversation_id: conversation_id)
                    .order(:created_at)
                    .last

        msg ? serialize(msg) : nil
      end

      private

      def serialize(message)
        {
          id: message.id,
          role: message.openai_role,
          content: message.content,
          metadata: message.metadata,
          created_at: message.created_at
        }
      end
    end
  end
end
