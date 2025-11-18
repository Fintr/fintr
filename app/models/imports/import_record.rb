# frozen_string_literal: true

module Imports
  class ImportRecord < ApplicationRecord
    belongs_to :import

    enum :status, {
      pending: "pending",
      success: "success",
      failed: "failed",
      edited: "edited"
    }

    scope :successful, -> { where(status: :success).where.not(record_id: nil) }
    scope :failed, -> { where(status: [:failed, :edited]) }
    scope :editable, -> { where(status: [:failed, :edited]) }

    # Polymorphic reference to the created record (only for successful records)
    def record
      return nil if record_id.nil? || record_type.nil?

      record_type.constantize.find_by(id: record_id)
    end

    def editable?
      failed? || edited?
    end

    def record=(model_instance)
      self.record_type = model_instance.class.name
      self.record_id = model_instance.id
      self.status = :success
    end

    # Get the data to use for import (edited if available, otherwise original)
    def import_data
      edited_data.present? ? edited_data : original_data
    end

    # Mark as edited when user updates the data
    def mark_as_edited(data)
      self.edited_data = data
      self.status = :edited
      save!
    end
  end
end
