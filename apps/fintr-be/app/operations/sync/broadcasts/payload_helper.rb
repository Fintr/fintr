# frozen_string_literal: true

module Sync
  module Broadcasts
    module PayloadHelper
      module_function

      def stringify(value)
        case value
        when Hash
          value.transform_keys(&:to_s).transform_values { |nested| stringify(nested) }
        when Array
          value.map { |nested| stringify(nested) }
        when Date
          value.iso8601
        when Time, ActiveSupport::TimeWithZone
          value.iso8601(3)
        when Symbol
          value.to_s
        else
          value
        end
      end

      def extract_entity_id(payload)
        return if payload.blank?

        id = payload[:id] || payload["id"]
        id.present? ? id.to_s : nil
      end
    end
  end
end
