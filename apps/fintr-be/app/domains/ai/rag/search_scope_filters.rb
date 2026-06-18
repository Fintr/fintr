# frozen_string_literal: true

module Ai
  module Rag
    # Hard scope filters shared by vector search and semantic transaction resolution.
    # Excludes text/topic prefilters — semantic similarity handles relevance.
    class SearchScopeFilters
      class << self
        def vector_filters_for(
          time_range: nil,
          filters: {}
        )
          hard = {
            embeddable_type: "Transactions::Transaction",
          }

          account = filters[:accounts]&.first || filters[:account]
          hard[:account] = account if account.present?

          if filters[:transaction_type]&.any?
            hard[:transaction_type] = filters[:transaction_type].first
          end

          date_range = date_range_for(time_range)
          hard[:date_from] = date_range[:from]&.iso8601 if date_range[:from]
          hard[:date_to] = date_range[:to]&.iso8601 if date_range[:to]

          hard.compact
        end

        def date_range_for(time_range)
          return {} unless time_range

          case time_range[:period]
          when "this_month"
            range_for(Date.current.all_month)
          when "last_month"
            range_for(Date.current.last_month.all_month)
          when "this_week"
            range_for(Date.current.all_week)
          when "last_week"
            range_for(Date.current.last_week.all_week)
          when "this_year"
            range_for(Date.current.all_year)
          when "last_year"
            range_for(Date.current.last_year.all_year)
          when "custom"
            {
              from: parse_date(time_range[:start_date]),
              to: parse_date(time_range[:end_date]),
            }
          else
            {}
          end
        end

        private

        def range_for(range)
          {
            from: range.begin.to_date,
            to: range.end.to_date,
          }
        end

        def parse_date(value)
          return nil if value.blank?

          Date.parse(value.to_s)
        rescue Date::Error
          nil
        end
      end
    end
  end
end
