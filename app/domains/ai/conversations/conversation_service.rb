# frozen_string_literal: true

module Ai
  module Conversations
    # High-level conversation service
    # Orchestrates conversation operations
    class ConversationService
      def initialize(
        repository: nil,
        context_builder: nil
      )
        @repository = repository || MessageRepository.new
        @context_builder_factory = ->(id) {
          ContextBuilder.new(
            conversation_id: id,
            repository: @repository,
          )
        }
      end

      # Add a user message to the conversation
      # @param conversation_id [String]
      # @param content [String]
      # @param metadata [Hash]
      # @return [Ai::ConversationMessage]
      def add_user_message(
        conversation_id:,
        content:,
        metadata: {}
      )
        save_message(
          conversation_id: conversation_id,
          role: 'user',
          content: content,
          metadata: metadata,
        )
      end

      # Add an assistant message to the conversation
      # @param conversation_id [String]
      # @param content [String]
      # @param metadata [Hash]
      # @return [Ai::ConversationMessage]
      def add_assistant_message(
        conversation_id:,
        content:,
        metadata: {}
      )
        save_message(
          conversation_id: conversation_id,
          role: 'assistant',
          content: content,
          metadata: metadata,
        )
      end

      # Build context for LLM API call
      # @param conversation_id [String]
      # @param system_prompt [String]
      # @param user_query [String]
      # @return [Array<Hash>]
      def build_context(
        conversation_id:,
        system_prompt:,
        user_query:
      )
        builder = @context_builder_factory.call(conversation_id)

        builder.build(
          system_prompt: system_prompt,
          user_query: user_query,
        )
      end

      # Get conversation summary
      # @param conversation_id [String]
      # @return [Hash]
      def summary(conversation_id)
        builder = @context_builder_factory.call(conversation_id)
        builder.statistics
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
