# frozen_string_literal: true

module Admin
  module Queries
    # Active users in a calendar month: distinct +activity_date+ count ≥ +MIN_ACTIVE_DAYS+ on
    # +UserActivity+ rows matching +active_users+ (authenticated app usage). OCR is summed
    # +tokens_used+ for +pure_ai_ocr+ +Ai::Usage+ in that month for those users only.
    class MonthlyActiveUserOcrStatsQuery < BaseQuery
      MIN_ACTIVE_DAYS = 15

      class Contract < Dry::Validation::Contract
        params do
          required(:start_date).value(:date)
          required(:end_date).value(:date)
          optional(:page).maybe(:integer)
          optional(:per_page).maybe(:integer)
        end
      end

      def initialize(params: {})
        super(relation: UserActivity.all, params:)
      end

      def call
        validated = step validate
        step build_stats(validated:)
      end

      private

      def validate
        contract = Contract.new.call(
          start_date: params[:start_date],
          end_date: params[:end_date],
          page: params[:page],
          per_page: params[:per_page]
        )
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def build_stats(validated:)
        start_date = validated[:start_date]
        end_date = validated[:end_date]
        monthly_rows = each_calendar_month(start_date:, end_date:).map do |month_start, month_end|
          stats_for_calendar_month(month_start:, month_end:)
        end

        with_active_users = monthly_rows.reject { |r| r[:active_user_count].zero? }
        summary = {
          average_monthly_ocr_across_months: average_of_monthly_means(with_active_users),
          min_active_days_required: MIN_ACTIVE_DAYS,
          months_with_active_users: with_active_users.size,
          months_in_range: monthly_rows.size
        }

        page = validated[:page].presence&.to_i
        page = 1 unless page&.positive?
        per_page = (validated[:per_page].presence&.to_i || 12).clamp(1, 120)
        sliced = Kaminari.paginate_array(monthly_rows).page(page).per(per_page)

        Success(
          {
            monthly_active_user_ocr: sliced.to_a,
            monthly_active_user_ocr_meta: {
              page: sliced.current_page,
              per_page: sliced.limit_value,
              total_count: monthly_rows.size,
              total_pages: sliced.total_pages
            },
            ocr_active_user_summary: summary
          }
        )
      end

      def each_calendar_month(start_date:, end_date:)
        months = []
        cursor = start_date.beginning_of_month
        while cursor <= end_date
          months << [cursor, cursor.end_of_month]
          cursor = cursor.next_month
        end
        months
      end

      def stats_for_calendar_month(month_start:, month_end:)
        active_user_ids = active_user_ids_for_month(month_start:, month_end:)
        time_range = month_start.in_time_zone.beginning_of_day..month_end.in_time_zone.end_of_day

        total_tokens = if active_user_ids.empty?
                         0
                       else
                         Ai::Usage.where(
                           user_id: active_user_ids,
                           ai_type: :pure_ai_ocr,
                           created_at: time_range
                         ).sum(:tokens_used)
                       end

        count = active_user_ids.size
        avg = count.positive? ? (total_tokens.to_f / count).round(2) : 0.0

        {
          month: month_start.to_s,
          month_label: month_start.strftime("%B %Y"),
          active_user_count: count,
          total_ocr_tokens: total_tokens,
          average_ocr_tokens_per_active_user: avg
        }
      end

      def active_user_ids_for_month(month_start:, month_end:)
        UserActivity
          .where(activity_date: month_start..month_end)
          .active_users
          .group(:user_id)
          .having("COUNT(DISTINCT activity_date) >= ?", MIN_ACTIVE_DAYS)
          .pluck(:user_id)
      end

      def average_of_monthly_means(rows)
        return 0.0 if rows.empty?

        (rows.sum { |r| r[:average_ocr_tokens_per_active_user] } / rows.size.to_f).round(2)
      end
    end
  end
end
