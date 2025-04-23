# frozen_string_literal: true

module Api
  module V1
    class ApiController < ApplicationController
      include Secured

      before_action :authorize

      def current_space
        return nil if request.headers["X-Space-Code"].blank?

        Rails.cache.fetch("current_space_#{request.headers["X-Space-Code"]}", expires_in: 15.minutes) do
          @current_space ||= Spaces::Space.find_by(code: request.headers["X-Space-Code"])
        end
      end

      def with_current_params(params)
        params.merge(user_id: current_user.id, space_id: current_space.id)
      end
    end
  end
end
