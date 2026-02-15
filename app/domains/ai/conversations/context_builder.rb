# frozen_string_literal: true

module Ai
  module Conversations
    # Builds conversation context for LLM prompts
    # Single Responsibility: Managing conversation context
    class ContextBuilder
      MAX_CONTEXT_MESSAGES = 10

      def initialize(
        conversation_id: nil,
        repository: nil
      )
        @conversation_id = conversation_id
        @repository = repository || MessageRepository.new
      end

      # Build full message array for LLM API
      # @param system_prompt [String] System instructions
      # @param user_query [String] Current user message
      # @return [Array<Hash>] Array of message hashes
      def build(
        system_prompt:,
        user_query:
      )
        messages = []
        messages << build_system_message(system_prompt)
        messages += load_history if @conversation_id.present?
        messages << build_user_message(user_query)
        messages
      end

      # Load recent conversation context as text summary
      # @return [String, nil] Context summary or nil if no conversation
      def load_recent_context
        return nil unless @conversation_id.present?

        recent_messages = @repository.recent_messages(
          @conversation_id,
          limit: MAX_CONTEXT_MESSAGES,
        )

        return nil if recent_messages.empty?

        format_context(recent_messages)
      end

      # Get conversation statistics
      # @return [Hash] Statistics about the conversation
      def statistics
        return nil unless @conversation_id.present?

        total = @repository.count(@conversation_id)

        {
          total_messages: total,
          context_messages: [total, MAX_CONTEXT_MESSAGES].min,
          conversation_id: @conversation_id,
        }
      end

      private

      def build_system_message(content)
        {
          role: 'system',
          content: content,
        }
      end

      def build_user_message(content)
        {
          role: 'user',
          content: content,
        }
      end

      def load_history
        messages = @repository.recent_messages(
          @conversation_id,
          limit: MAX_CONTEXT_MESSAGES,
        )

        messages.map do |msg|
          {
            role: msg[:role],
            content: msg[:content],
          }
        end
      end

      def format_context(messages)
        exchanges = messages.each_slice(2).map do |slice|
          user_msg = slice[0]
          assistant_msg = slice[1]

          format_exchange(
            user_msg,
            assistant_msg,
          )
        end

        "PREVIOUS CONVERSATION:\n#{exchanges.join("\n\n")}\n\n"
      end

      def format_exchange(
        user_msg,
        assistant_msg
      )
        user_text = user_msg&.dig(:content)&.truncate(150) || ""
        assistant_text = assistant_msg&.dig(:content)&.truncate(150) || ""

        "User: #{user_text}\nAssistant: #{assistant_text}"
      end
    end
  end
end
