# frozen_string_literal: true

class UserActivityTrackingJob < ApplicationJob
  queue_as :default

  def perform(user_id:, activity_type: "api_request", date: Date.current)
    user = Auth::User.find_by(id: user_id)
    return unless user

    UserActivity.track_activity(
      user:,
      activity_type:,
      date:
    )
  rescue StandardError => e
    Rails.logger.error "UserActivityTrackingJob failed: #{e.message}"
    # Don't re-raise to avoid job retries for data integrity issues
  end
end
