# frozen_string_literal: true

module Admin
  module Operations
    class BuildUserActivityDrilldown < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          optional(:date).maybe(:date)
          optional(:start_date).maybe(:date)
          optional(:end_date).maybe(:date)
          optional(:page).maybe(:integer)
          optional(:per_page).maybe(:integer)
        end

        rule(:date, :start_date, :end_date) do
          if values[:date].blank? && (values[:start_date].blank? || values[:end_date].blank?)
            key(:base).failure("Provide date or both start_date and end_date")
          end
        end

        rule(:start_date, :end_date) do
          next if values[:start_date].blank? || values[:end_date].blank?

          if values[:end_date] < values[:start_date]
            key(:end_date).failure("must be on or after start_date")
          end
        end
      end

      def call(params)
        normalized = step normalize(params:)
        rows = step fetch_rows(normalized:)
        step paginate_and_wrap(normalized:, rows:)
      end

      private

      def normalize(params:)
        payload = params.deep_symbolize_keys
        result = Contract.new.call(payload)
        return Failure(result.errors.to_h) if result.failure?

        h = result.to_h
        start_date, end_date =
          if h[:date].present?
            [h[:date], h[:date]]
          else
            [h[:start_date], h[:end_date]]
          end

        page = h[:page].presence&.to_i
        page = 1 unless page&.positive?
        per_page = (h[:per_page].presence&.to_i || 50).clamp(1, 200)

        Success(
          {
            start_date:,
            end_date:,
            page:,
            per_page:
          }
        )
      end

      def fetch_rows(normalized:)
        query = Admin::Queries::UserActivityDrilldownQuery.new(
          params: {
            start_date: normalized[:start_date],
            end_date: normalized[:end_date]
          }
        )
        outcome = query.call
        return Failure(outcome.failure) unless outcome.success?

        Success(outcome.value!)
      end

      def paginate_and_wrap(normalized:, rows:)
        page = normalized[:page]
        per_page = normalized[:per_page]
        total_count = rows.size
        average_row = compute_average_row(rows:)
        sliced = Kaminari.paginate_array(rows).page(page).per(per_page)

        Success(
          {
            rows: sliced.to_a,
            average_row:,
            meta: {
              start_date: normalized[:start_date].to_s,
              end_date: normalized[:end_date].to_s,
              total_count:,
              page:,
              per_page:,
              total_pages: sliced.total_pages
            }
          }
        )
      end

      def compute_average_row(rows:)
        return if rows.empty?

        n = rows.size.to_f
        {
          id: "average",
          email: "—",
          full_name: "Average (all users)",
          api_request_count: (rows.sum { |r| r[:api_request_count] } / n).round(2),
          dashboard_viewed_count: (rows.sum { |r| r[:dashboard_viewed_count] } / n).round(2),
          total_requests: (rows.sum { |r| r[:total_requests] } / n).round(2),
          transactions_created: (rows.sum { |r| r[:transactions_created] } / n).round(2),
          standalone_transactions: (rows.sum { |r| r[:standalone_transactions] } / n).round(2),
          transfer_leg_transactions: (rows.sum { |r| r[:transfer_leg_transactions] } / n).round(2),
          transfers_created: (rows.sum { |r| r[:transfers_created] } / n).round(2),
          receipt_scans: (rows.sum { |r| r[:receipt_scans] } / n).round(2),
          ai_chat_usages: (rows.sum { |r| r[:ai_chat_usages] } / n).round(2),
          ai_interactions: (rows.sum { |r| r[:ai_interactions] } / n).round(2)
        }
      end
    end
  end
end
