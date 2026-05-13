# frozen_string_literal: true

module Api
  module V1
    class ProductPulseFeedbacksController < ApiController
      def create
        operation = ::ProductPulse::Operations::CreateFeedback.new.call(
          with_current_params(create_params)
        )

        return render_unprocessable_content(details: operation.failure) unless operation.success?

        serializer = ::ProductPulse::Serializers::FeedbackSerializer.render_as_hash(operation.value!)
        render_success(data: { product_pulse_feedback: serializer }, status: :created)
      end

      private

      def create_params
        p = params.permit(
          :notes,
          liked_areas: [],
          improve_areas: []
        )
        {
          notes: p[:notes],
          liked_areas: coerce_area_ids(p[:liked_areas].presence),
          improve_areas: coerce_area_ids(p[:improve_areas].presence)
        }
      end

      def coerce_area_ids(raw)
        case raw
        when nil, ""
          []
        when Array
          raw.flatten.compact.map(&:to_s).map(&:strip).reject(&:empty?).uniq
        when ActionController::Parameters
          hash = raw.to_unsafe_h
          if hash.keys.all? { |k| k.to_s.match?(/\A\d+\z/) }
            hash.sort_by { |k, _| k.to_s.to_i }.map { |_, v| v.to_s.strip }.reject(&:empty?).uniq
          else
            []
          end
        when String
          stripped = raw.strip
          if stripped.blank?
            []
          else
            begin
              parsed = JSON.parse(stripped)
              coerce_area_ids(parsed)
            rescue JSON::ParserError
              stripped.present? ? [stripped] : []
            end
          end
        else
          []
        end
      end
    end
  end
end
