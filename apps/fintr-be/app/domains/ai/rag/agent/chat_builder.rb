# frozen_string_literal: true

module Ai
  module Rag
    module Agent
      class ChatBuilder
        AGENT_TEMPERATURE = 0.2
        MAX_SEEDED_MESSAGES = 6

        attr_reader :pending_user_query

        def initialize(
          conversation_id:,
          user_query:,
          seed_history: true,
          max_seeded_messages: MAX_SEEDED_MESSAGES
        )
          @conversation_id = conversation_id
          @user_query = user_query.to_s.strip
          @seed_history = seed_history
          @max_seeded_messages = max_seeded_messages
        end

        def build
          llm = RubyLLM.chat(
            model: Rails.configuration.x.llm.agent_model,
            provider: Rails.configuration.x.llm.agent_provider.to_sym,
            assume_model_exists: true,
          )

          seed_conversation_history(llm) if @seed_history
          @pending_user_query = @user_query if @pending_user_query.blank?

          llm.with_temperature(AGENT_TEMPERATURE)
        end

        private

        def seed_conversation_history(llm)
          messages = Ai::ConversationMessage
            .where(conversation_id: @conversation_id)
            .where(openai_role: %i[user assistant])
            .where.not(content: [nil, ""])
            .order(:created_at)
            .to_a

          if messages.last&.openai_role.to_s == "user"
            @pending_user_query = messages.pop.content.to_s.strip
          end

          @pending_user_query = @user_query if @user_query.present?

          messages = messages.last(@max_seeded_messages) if messages.size > @max_seeded_messages

          messages.each do |message|
            llm.add_message(
              role: message.openai_role.to_sym,
              content: message.content.to_s,
            )
          end
        end
      end
    end
  end
end
