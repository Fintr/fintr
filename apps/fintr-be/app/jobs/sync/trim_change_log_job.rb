# frozen_string_literal: true

module Sync
  class TrimChangeLogJob < ApplicationJob
    queue_as :default

    RETENTION_DAYS = 90

    def perform
      cutoff = RETENTION_DAYS.days.ago
      deleted = Sync::ChangeLogEntry.where("created_at < ?", cutoff).delete_all

      Rails.logger.info(
        "[Sync::TrimChangeLogJob] Trimmed #{deleted} change log rows older than #{RETENTION_DAYS} days",
      )
    end
  end
end
