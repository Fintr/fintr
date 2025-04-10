# frozen_string_literal: true

module Api
  module V1
    class UsersController < ApplicationController
      include JwtAuthenticable

      def profile
        render json: {
          id: current_user.id,
          email: current_user.email,
          name: current_user.name,
          picture: current_user.picture
        }
      end
    end
  end
end
