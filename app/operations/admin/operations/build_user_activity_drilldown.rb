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
        sliced = Kaminari.paginate_array(rows).page(page).per(per_page)

        Success(
          {
            rows: sliced.to_a,
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
    end
  end
end
