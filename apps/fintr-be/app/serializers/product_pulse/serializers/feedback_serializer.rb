# frozen_string_literal: true

module ProductPulse
  module Serializers
    class FeedbackSerializer < Blueprinter::Base
      identifier :id

      fields :period_key,
             :notes,
             :created_at,
             :updated_at

      field :liked_areas do |record|
        ProductPulse::Serializers::FeedbackSerializer.normalize_area_ids(record.liked_areas)
      end

      field :improve_areas do |record|
        ProductPulse::Serializers::FeedbackSerializer.normalize_area_ids(record.improve_areas)
      end

      field :user do |record|
        {
          id: record.user_id,
          email: record.user&.email,
          full_name: record.user&.full_name
        }
      end

      field :space do |record|
        {
          id: record.space_id,
          name: record.space&.name,
          code: record.space&.code
        }
      end

      def self.normalize_area_ids(value)
        case value
        when nil
          []
        when Array
          value.flatten.compact.map(&:to_s).map(&:strip).reject(&:empty?).uniq
        when String
          stripped = value.strip
          if stripped.blank?
            []
          else
            begin
              parsed = JSON.parse(stripped)
              normalize_area_ids(parsed)
            rescue JSON::ParserError
              stripped.present? ? [stripped] : []
            end
          end
        when Hash
          value.sort_by { |k, _| k.to_s.to_i }.map { |_, v| v.to_s.strip }.reject(&:empty?).uniq
        else
          []
        end
      end
    end
  end
end
