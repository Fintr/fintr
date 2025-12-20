# frozen_string_literal: true

module Imports
  class Import < ApplicationRecord
    belongs_to :user, class_name: "Auth::User"
    belongs_to :space, class_name: "Spaces::Space"
    has_many :import_records, dependent: :destroy

    has_one_attached :file

    enum :status, {
      pending: "pending",
      processing: "processing",
      completed: "completed",
      failed: "failed",
      reverted: "reverted"
    }

    validates :import_location, presence: true, inclusion: { in: %w[onboarding settings] }

    scope :recent, -> { order(created_at: :desc) }
    scope :for_space, ->(space) { where(space: space) }

    def can_revert?
      (completed? || failed?) && import_records.successful.any?
    end

    def failed_records
      import_records.failed
    end

    def successful_records
      import_records.successful
    end

    def success?
      import_records.failed.empty?
    end
  end
end
