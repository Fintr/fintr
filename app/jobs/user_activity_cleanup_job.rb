# frozen_string_literal: true

class UserActivityCleanupJob < ApplicationJob
  queue_as :default

  def perform(retention_days: 90)
    cutoff_date = retention_days.days.ago.to_date

    deleted_count = UserActivity.where("activity_date < ?", cutoff_date).delete_all

    Rails.logger.info "UserActivityCleanupJob: Deleted #{deleted_count} user activity records older than #{retention_days} days"
  rescue StandardError => e
    Rails.logger.error "UserActivityCleanupJob failed: #{e.message}"
    raise e # Re-raise to trigger job retry
  end
end
