# frozen_string_literal: true

module Ai
  module Charts
    class TimeSeriesAggregator < BaseAggregator
      def aggregate(data)
        return data if data.size <= @max_items

        entries = data.to_a

        if monthly_data?(entries)
          aggregate_by_month(entries)
        elsif daily_data?(entries)
          aggregate_by_week(entries)
        else
          TopNAggregator.new(max_items: @max_items).aggregate(data)
        end
      end

      private

      def monthly_data?(entries)
        entries.any? { |key, _| key.to_s.match?(/\d{4}-\d{2}/) }
      end

      def daily_data?(entries)
        entries.any? { |key, _| key.to_s.match?(/\d{4}-\d{2}-\d{2}/) }
      end

      def aggregate_by_month(entries)
        grouped = entries.group_by { |key, _| extract_month(key) }

        aggregated = grouped.transform_values do |month_entries|
          month_entries.sum { |_, value| extract_value(value) }
        end

        TopNAggregator.new(max_items: @max_items).aggregate(aggregated)
      end

      def aggregate_by_week(entries)
        grouped = entries.group_by { |key, _| extract_week(key) }

        aggregated = grouped.transform_values do |week_entries|
          week_entries.sum { |_, value| extract_value(value) }
        end

        TopNAggregator.new(max_items: @max_items).aggregate(aggregated)
      end

      def extract_month(key)
        key.to_s[0..6] # "2024-01-15" -> "2024-01"
      end

      def extract_week(key)
        date =
          begin
            Date.parse(key.to_s)
          rescue ArgumentError, TypeError
            return key.to_s
          end

        date.beginning_of_week.to_s
      end
    end
  end
end
