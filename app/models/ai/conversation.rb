# frozen_string_literal: true

module Ai
  class Conversation < ApplicationRecord
    self.table_name = "ai_conversations"
    belongs_to :user, class_name: "Auth::User"
    belongs_to :space, class_name: "Spaces::Space"
    has_many :conversation_messages, class_name: "Ai::ConversationMessage", dependent: :destroy

    validates :title, presence: true

    scope :for_user, ->(user_id) { where(user_id: user_id) }
    scope :for_space, ->(space_id) { where(space_id: space_id) }
    scope :recent, -> { order(last_message_at: :desc, created_at: :desc) }

    def update_last_message_at!
      update!(last_message_at: Time.current)
    end

    def add_user_message(content)
      conversation_messages.create!(
        content: content,
        openai_role: :user
      ).tap { update_last_message_at! }
    end

    def add_assistant_message(content, metadata = {})
      conversation_messages.create!(
        content: content,
        openai_role: :assistant,
        metadata: metadata
      ).tap { update_last_message_at! }
    end

    def messages_chronological
      conversation_messages.order(:created_at)
    end

    def last_message
      conversation_messages.order(:created_at).last
    end
  end
end
