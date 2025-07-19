# frozen_string_literal: true

module Api
  module V1
    class ApiController < ApplicationController
      include Secured

      before_action :authorize
      before_action :current_space

      def current_space
        render_unauthorized(message: "No space code provided") and return unless space_code = request.headers["X-Space-Code"]

        space = Rails.cache.fetch("current_space_#{space_code}", expires_in: 15.minutes) do
          Spaces::Space.find_by(code: space_code)
        end
        @current_space = space if cached_current_user.spaces.include?(space)
        return @current_space if @current_space.present?

        render_unauthorized(message: "User cannot access #{space_code}")
      end

      def with_current_params(params = {})
        params.merge(user_id: current_user.id, space_id: current_space.id, space_code: current_space.code)
      end
    end
  end
end
