# frozen_string_literal: true

module Ai
  class Usage < ApplicationRecord
    self.table_name = "ai_usages"

    belongs_to :user, class_name: "Auth::User"
    belongs_to :space, class_name: "Spaces::Space"

    enum :ai_type, {
      pure_ai_ocr: "pure_ai_ocr",
      ai_chat: "ai_chat",
      tag_style_image: "tag_style_image",
    }
    enum :status, {
      pending: "pending",
      success: "success",
      failure: "failure"
    }

    validates :ai_type, presence: true
    validates :status, presence: true
    validates :tokens_used, presence: true, numericality: { greater_than: 0 }
    validates :time_seconds, presence: true, numericality: { greater_than_or_equal_to: 0 }

    scope :pending, -> { where(status: :pending) }
    scope :success, -> { where(status: :success) }
    scope :failure, -> { where(status: :failure) }
  end
end
