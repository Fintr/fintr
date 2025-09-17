# frozen_string_literal: true

module Admin
  module Operations
    class CreateUserActivityAnalytics < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          optional(:start_date).maybe(:date)
          optional(:end_date).maybe(:date)
          optional(:group_by).maybe(:string)
        end
      end

      def validate(params)
        result = Contract.new.call(params)
        return Failure(result.errors.to_h) if result.failure?

        Success(params.to_h)
      end

      def call(params)
        params = step validate(params)
        daily_counts = step get_daily_active_users(params)
        summary_stats = step get_summary_stats(params)
        activity_breakdown = step get_activity_breakdown(params)

        analytics_data = {
          daily_active_users: daily_counts,
          summary: summary_stats,
          activity_breakdown:
        }

        analytics_data
      end

      private

      def get_daily_active_users(params)
        query = Admin::Queries::DailyActiveUsersQuery.new(params:)
        result = query.call
        return Failure(result.failure) unless result.success?

        Success(result.value!)
      end

      def get_summary_stats(params)
        start_date = params[:start_date] || 30.days.ago.to_date
        end_date = params[:end_date] || Date.current

        # Get comprehensive usage statistics
        usage_stats = UserActivity.usage_statistics(
          start_date:,
          end_date:
        )

        total_days = (end_date - start_date).to_i + 1
        average_daily_active_users = usage_stats[:total_active_users].to_f / total_days

        Success({
          total_active_users: usage_stats[:total_active_users],
          total_api_requests: usage_stats[:total_api_requests],
          total_logins: usage_stats[:total_logins],
          total_transactions_created: usage_stats[:total_transactions_created],
          total_dashboard_views: usage_stats[:total_dashboard_views],
          average_requests_per_user: usage_stats[:average_requests_per_user],
          total_days:,
          average_daily_active_users: average_daily_active_users.round(2),
          date_range: {
            start_date: start_date.to_s,
            end_date: end_date.to_s
          }
        })
      end

      def get_activity_breakdown(params)
        start_date = params[:start_date] || 30.days.ago.to_date
        end_date = params[:end_date] || Date.current

        # Get activity breakdown using the new cumulative counters
        activities = UserActivity.for_date_range(start_date, end_date)

        breakdown = {
          logins: activities.sum(:login_count),
          api_requests: activities.sum(:api_request_count),
          transactions_created: activities.sum(:transaction_created_count),
          dashboard_views: activities.sum(:dashboard_viewed_count)
        }

        Success(breakdown)
      end
    end
  end
end
