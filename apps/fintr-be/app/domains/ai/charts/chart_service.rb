# frozen_string_literal: true

module Ai
  module Charts
    # Service for preparing chart data
    # Single Responsibility: Chart data preparation and aggregation
    class ChartService
      DEFAULT_MAX_ITEMS = 6

      def initialize(
        aggregator_type: :top_n,
        max_items: DEFAULT_MAX_ITEMS
      )
        @aggregator = build_aggregator(aggregator_type, max_items)
      end

      # Prepare data for chart rendering
      # @param data [Hash] Raw chart data
      # @return [Hash] Prepared and aggregated data
      def prepare(data)
        return {} if data.nil? || data.empty?

        normalized = normalize_data(data)
        @aggregator.aggregate(normalized)
      end

      private

      def build_aggregator(type, max_items)
        case type
        when :top_n
          TopNAggregator.new(max_items: max_items)
        else
          raise ArgumentError, "Unknown aggregator type: #{type}"
        end
      end

      def normalize_data(data)
        data.transform_values do |value|
          case value
          when Numeric
            { value: value }
          when Hash
            value
          else
            { value: value.to_f }
          end
        end
      end
    end
  end
end
