# frozen_string_literal: true

module Ai
  module Charts
    # Aggregates data to top N items, grouping rest as 'Others'
    class TopNAggregator < BaseAggregator
      OTHERS_COLOR = '#9CA3AF'.freeze

      def aggregate(data)
        return data if data.size <= @max_items

        sorted = sort_by_value(data)
        top_items = take_top(sorted)
        others = calculate_others(sorted)

        merge_results(top_items, others)
      end

      private

      def sort_by_value(data)
        data.sort_by { |_, v| -extract_value(v) }
      end

      def take_top(sorted)
        sorted.first(@max_items - 1).to_h
      end

      def calculate_others(sorted)
        remaining = sorted[@max_items - 1..]
        return nil if remaining.empty?

        sum = remaining.sum { |_, v| extract_value(v) }

        {
          'Others' => {
            value: sum,
            color: OTHERS_COLOR,
          }
        }
      end

      def merge_results(top_items, others)
        if others
          top_items.merge(others)
        else
          top_items
        end
      end
    end
  end
end
