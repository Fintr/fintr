# frozen_string_literal: true

module Ai
  class ConversationMessage < ApplicationRecord
    self.table_name = "ai_conversation_messages"
    belongs_to :conversation, class_name: "Ai::Conversation"

    validates :content, :openai_role, presence: true

    scope :user_messages, -> { where(openai_role: :user) }
    scope :assistant_messages, -> { where(openai_role: :assistant) }
    scope :chronological, -> { order(:created_at) }

    enum :openai_role, {
      user: 0,
      developer: 1,
      assistant: 2
    }

    def user_message?
      openai_role == :user
    end

    def assistant_message?
      openai_role == :assistant
    end
  end
end
