# frozen_string_literal: true

module Crm
  class TicketResponse < ApplicationRecord
    self.table_name = "crm_ticket_responses"

    belongs_to :ticket
    belongs_to :responder, class_name: "Auth::User", optional: true

    has_many_attached :images

    validates :message, presence: true, length: { maximum: 2000 }
    validates :response_type, presence: true
    validate :validate_images

    enum :response_type, {
      user_reply: "user_reply",
      admin_response: "admin_response",
      system_update: "system_update"
    }

    scope :chronological, -> { order(created_at: :asc) }
    scope :admin_responses, -> { where(response_type: :admin_response) }
    scope :user_replies, -> { where(response_type: :user_reply) }

    def from_admin?
      response_type == "admin_response"
    end

    def from_user?
      response_type == "user_reply"
    end

    private

    def validate_images
      return unless images.attached?

      if images.count > 5
        errors.add(:images, "cannot exceed 5 images per response")
      end

      images.each do |image|
        unless image.content_type.in?(%w[image/jpeg image/png image/webp])
          errors.add(:images, "must be JPEG, PNG, or WebP format")
        end

        if image.byte_size > 10.megabytes
          errors.add(:images, "must be less than 10MB each")
        end
      end
    end
  end
end
