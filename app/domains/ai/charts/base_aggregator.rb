# frozen_string_literal: true

module Ai
  module Charts
    # Base class for chart data aggregators
    class BaseAggregator
      def initialize(max_items: 6)
        @max_items = max_items
      end

      # Aggregate data to limit number of items
      # @param data [Hash] Raw chart data
      # @return [Hash] Aggregated data
      def aggregate(data)
        raise NotImplementedError, "#{self.class} must implement #aggregate"
      end

      protected

      # Extract numeric value from data item
      # @param item [Hash, Numeric, String]
      # @return [Float]
      def extract_value(item)
        case item
        when Hash
          item[:value] || item['value'] || item[:amount] || item['amount'] || 0
        when Numeric
          item
        else
          0
        end
      end
    end
  end
end
