# frozen_string_literal: true

module Api
  module V1
    class ApiController < ApplicationController
      include Secured

      before_action :authorize

      def current_space
        Rails.cache.fetch("current_space_#{request.headers["X-Space-Code"]}", expires_in: 15.minutes) do
          @current_space ||= Spaces::Space.find_by(code: request.headers["X-Space-Code"])
        end
      end
    end
  end
end
