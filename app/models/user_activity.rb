# frozen_string_literal: true

class UserActivity < ApplicationRecord
  belongs_to :user, class_name: "Auth::User"

  validates :activity_date, presence: true
  validates :user_id, uniqueness: { scope: :activity_date, message: "already has activity recorded for this date" }

  # Validate that counters are non-negative
  validates :login_count, :api_request_count, :transaction_created_count,
            :dashboard_viewed_count, :total_requests,
            numericality: { greater_than_or_equal_to: 0 }

  scope :for_date, ->(date) { where(activity_date: date) }
  scope :for_date_range, ->(start_date, end_date) { where(activity_date: start_date..end_date) }
  scope :recent, ->(days = 30) { where(activity_date: days.days.ago..Date.current) }
  scope :active_users, -> { where("total_requests > 0 OR login_count > 0") }

  # Class method to track user activity (increments counters)
  def self.track_activity(user:, activity_type: "login", date: Date.current, increment: 1)
    activity = find_or_create_by(
      user:,
      activity_date: date
    )

    # Increment the appropriate counter
    case activity_type.to_s
    when "login"
      activity.increment!(:login_count, increment)
    when "api_request"
      activity.increment!(:api_request_count, increment)
      activity.increment!(:total_requests, increment)
    when "transaction_created"
      activity.increment!(:transaction_created_count, increment)
    when "dashboard_viewed"
      activity.increment!(:dashboard_viewed_count, increment)
    end

    activity
  end


  # Get daily active users count for a date range
  def self.daily_active_users(start_date:, end_date:)
    where(activity_date: start_date..end_date)
      .active_users
      .group(:activity_date)
      .count(:user_id)
      .transform_keys(&:to_s)
  end

  # Get unique active users count for a date range
  def self.unique_active_users(start_date:, end_date:)
    where(activity_date: start_date..end_date)
      .active_users
      .distinct
      .count(:user_id)
  end

  # Get total API requests for a date range
  def self.total_api_requests(start_date:, end_date:)
    where(activity_date: start_date..end_date)
      .sum(:api_request_count)
  end

  # Get average requests per active user for a date range
  def self.average_requests_per_user(start_date:, end_date:)
    total_requests = total_api_requests(start_date:, end_date:)
    active_users = unique_active_users(start_date:, end_date:)

    return 0 if active_users.zero?

    (total_requests.to_f / active_users).round(2)
  end

  # Get usage statistics for a date range
  def self.usage_statistics(start_date:, end_date:)
    activities = where(activity_date: start_date..end_date)

    {
      total_active_users: activities.active_users.distinct.count(:user_id),
      total_api_requests: activities.sum(:api_request_count),
      total_logins: activities.sum(:login_count),
      total_transactions_created: activities.sum(:transaction_created_count),
      total_dashboard_views: activities.sum(:dashboard_viewed_count),
      average_requests_per_user: average_requests_per_user(start_date:, end_date:)
    }
  end
end
