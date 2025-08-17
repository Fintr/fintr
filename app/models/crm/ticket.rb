# frozen_string_literal: true

module Crm
  class Ticket < ApplicationRecord
    self.table_name = "crm_tickets"

    belongs_to :user, class_name: "Auth::User"
    belongs_to :space, class_name: "Spaces::Space"

    has_many :ticket_responses, dependent: :destroy
    has_many_attached :images

    validates :title, presence: true, length: { maximum: 255 }
    validates :description, presence: true, length: { maximum: 2000 }
    validates :ticket_type, presence: true
    validates :priority, presence: true
    validate :validate_images

    enum :ticket_type, {
      bug_report: "bug_report",
      feature_request: "feature_request",
      general_feedback: "general_feedback",
      help_request: "help_request",
      billing_issue: "billing_issue",
      account_issue: "account_issue",
      other: "other"
    }

    enum :priority, {
      low: "low",
      medium: "medium",
      high: "high",
      urgent: "urgent"
    }

    enum :status, {
      open: "open",
      in_progress: "in_progress",
      resolved: "resolved",
      dismissed: "dismissed"
    }

    scope :recent, -> { order(created_at: :desc) }
    scope :by_status, ->(status) { where(status: status) if status.present? }
    scope :by_type, ->(type) { where(ticket_type: type) if type.present? }
    scope :by_priority, ->(priority) { where(priority: priority) if priority.present? }

    def response_count
      ticket_responses.count
    end

    def latest_response
      ticket_responses.order(created_at: :desc).first
    end

    def has_unread_responses?
      latest_response&.created_at > updated_at if latest_response
    end

    private

    def validate_images
      return unless images.attached?

      images.each do |image|
        validate_image_content_type(image)
        validate_image_size(image)
      end
    end

    def validate_image_content_type(image)
      acceptable_types = ["image/jpeg", "image/png", "image/jpg", "image/gif", "image/webp"]
      unless acceptable_types.include?(image.content_type)
        errors.add(:images, "must be a JPEG, PNG, GIF, or WebP image")
      end
    end

    def validate_image_size(image)
      max_size = 10.megabytes
      if image.byte_size > max_size
        errors.add(:images, "must be less than #{max_size / 1.megabyte}MB")
      end
    end
  end
end
