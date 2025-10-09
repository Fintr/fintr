# frozen_string_literal: true

module Ai
  class Interaction < ApplicationRecord
    self.table_name = "ai_interactions"

    belongs_to :user, class_name: "Auth::User"
    belongs_to :space, class_name: "Spaces::Space"

    # Status is stored as a string, not an enum
    # Valid statuses: "pending", "success", "failure"

    validates :session_id, presence: true
    validates :request, presence: true
    validates :status, presence: true
    validates :tokens_used, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :time_seconds, presence: true, numericality: { greater_than_or_equal_to: 0 }

    scope :for_user, ->(user_id) { where(user_id: user_id) }
    scope :for_space, ->(space_id) { where(space_id: space_id) }
    scope :recent, -> { order(created_at: :desc) }
    scope :successful, -> { where(status: "success") }
    scope :failed, -> { where(status: "failure") }
    scope :pending, -> { where(status: "pending") }

    def self.create_from_chat_session(session_id, user_id, space_id, request, response = nil, status = "pending", error = nil, tokens_used = 0, time_seconds = 0.0, metadata = {})
      create!(
        session_id: session_id,
        user_id: user_id,
        space_id: space_id,
        request: request,
        response: response,
        status: status,
        error: error,
        tokens_used: tokens_used,
        time_seconds: time_seconds,
        metadata: metadata
      )
    end

    def update_with_response(response, tokens_used, time_seconds, metadata = {}, enhanced_prompt = nil)
      update!(
        response: response,
        tokens_used: tokens_used,
        time_seconds: time_seconds,
        status: "success",
        metadata: metadata,
        enhanced_prompt: enhanced_prompt
      )
    end

    def update_with_error(error)
      update!(
        status: "failure",
        error: error
      )
    end
  end
end
