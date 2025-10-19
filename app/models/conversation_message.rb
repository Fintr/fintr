# frozen_string_literal: true

module Ai
  class ConversationMessage < ApplicationRecord
    self.table_name = "ai_conversation_messages"
    belongs_to :conversation, class_name: "Ai::Conversation"

    validates :content, presence: true
    validates :openai_role, presence: true

    enum openai_role: {
      user: 0,
      assistant: 1,
      developer: 2
    }

    scope :user_messages, -> { where(openai_role: :user) }
    scope :assistant_messages, -> { where(openai_role: :assistant) }
    scope :chronological, -> { order(:created_at) }
  end
end
