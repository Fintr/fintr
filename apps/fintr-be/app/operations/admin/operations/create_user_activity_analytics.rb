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

      def call(params)
        params = step validate(params: params)
        daily_counts = step get_daily_active_users(params:)
        summary_stats = step get_summary_stats(params:)
        activity_breakdown = step get_activity_breakdown(params:)
        ocr_active_bundle = step get_monthly_active_user_ocr(params:)
        step assemble_analytics(
          daily_counts:,
          summary_stats:,
          activity_breakdown:,
          ocr_active_bundle:
        )
      end

      private

      def validate(params:)
        result = Contract.new.call(params)
        return Failure(result.errors.to_h) if result.failure?

        Success(params.to_h)
      end

      def get_daily_active_users(params:)
        query = Admin::Queries::DailyActiveUsersQuery.new(params:)
        result = query.call
        return Failure(result.failure) unless result.success?

        Success(result.value!)
      end

      def get_summary_stats(params:)
        start_date = params[:start_date] || 30.days.ago.to_date
        end_date = params[:end_date] || Date.current
        time_range = start_date.in_time_zone.beginning_of_day..end_date.in_time_zone.end_of_day

        usage_stats = UserActivity.usage_statistics(
          start_date:,
          end_date:
        )

        total_days = (end_date - start_date).to_i + 1
        average_daily_active_users = usage_stats[:total_active_users].to_f / total_days

        transactions_created = Transactions::Transaction.non_draft.where(created_at: time_range).count
        transfers_created = Transactions::Transfer.where(created_at: time_range).count
        receipt_scans = Ai::Usage.where(created_at: time_range, ai_type: :pure_ai_ocr).count
        ai_chat_usages = Ai::Usage.where(created_at: time_range, ai_type: :ai_chat).count

        Success(
          {
            total_active_users: usage_stats[:total_active_users],
            total_api_requests: usage_stats[:total_api_requests],
            total_logins: usage_stats[:total_logins],
            total_transactions_created: transactions_created,
            total_transfers_created: transfers_created,
            total_receipt_scans: receipt_scans,
            total_ai_chat_usages: ai_chat_usages,
            total_dashboard_views: usage_stats[:total_dashboard_views],
            average_requests_per_user: usage_stats[:average_requests_per_user],
            total_days:,
            average_daily_active_users: average_daily_active_users.round(2),
            date_range: {
              start_date: start_date.to_s,
              end_date: end_date.to_s
            }
          }
        )
      end

      def get_activity_breakdown(params:)
        start_date = params[:start_date] || 30.days.ago.to_date
        end_date = params[:end_date] || Date.current
        time_range = start_date.in_time_zone.beginning_of_day..end_date.in_time_zone.end_of_day

        activities = UserActivity.for_date_range(start_date, end_date)

        transactions_created = Transactions::Transaction.non_draft.where(created_at: time_range).count
        transfers_created = Transactions::Transfer.where(created_at: time_range).count
        receipt_scans = Ai::Usage.where(created_at: time_range, ai_type: :pure_ai_ocr).count
        ai_chat_usages = Ai::Usage.where(created_at: time_range, ai_type: :ai_chat).count

        breakdown = {
          logins: activities.sum(:login_count),
          api_requests: activities.sum(:api_request_count),
          transactions_created:,
          transfers_created:,
          receipt_scans:,
          ai_chat_usages:,
          dashboard_views: activities.sum(:dashboard_viewed_count)
        }

        Success(breakdown)
      end

      def get_monthly_active_user_ocr(params:)
        p = params.with_indifferent_access
        start_date = p[:start_date].presence || 30.days.ago.to_date
        end_date = p[:end_date].presence || Date.current
        page = p[:monthly_ocr_page].presence&.to_i
        page = 1 unless page&.positive?
        per_page = (p[:monthly_ocr_per_page].presence&.to_i || 12).clamp(1, 120)
        query = Admin::Queries::MonthlyActiveUserOcrStatsQuery.new(
          params: {
            start_date:,
            end_date:,
            page:,
            per_page:
          }
        )
        result = query.call
        return Failure(result.failure) unless result.success?

        Success(result.value!)
      end

      def assemble_analytics(daily_counts:, summary_stats:, activity_breakdown:, ocr_active_bundle:)
        Success(
          {
            daily_active_users: daily_counts,
            summary: summary_stats,
            activity_breakdown: activity_breakdown,
            monthly_active_user_ocr: ocr_active_bundle[:monthly_active_user_ocr],
            monthly_active_user_ocr_meta: ocr_active_bundle[:monthly_active_user_ocr_meta],
            ocr_active_user_summary: ocr_active_bundle[:ocr_active_user_summary]
          }
        )
      end
    end
  end
end
