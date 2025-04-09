# frozen_string_literal: true

module Api
  module V1
    module Auth
      class SessionsController < Devise::SessionsController
        respond_to :json

        # Override the create method to handle failed authentication
        def create
          self.resource = warden.authenticate!(auth_options)
          sign_in(resource_name, resource)

          render json: {
            user: resource,
            message: "Logged in successfully",
            token: request.env["warden-jwt_auth.token"]
          }, status: :ok
        rescue
          render json: {
            error: "Invalid email or password",
            message: "Authentication failed"
          }, status: :unauthorized
        end

        private

        def respond_with(resource, _opts = {})
          render json: {
            user: resource,
            message: "Logged in successfully",
            token: request.env["warden-jwt_auth.token"]
          }, status: :ok
        end

        def respond_to_on_destroy
          if current_user
            render json: { message: "Logged out successfully" }, status: :ok
          else
            render json: { message: "Logged out failure." }, status: :unauthorized
          end
        end
      end
    end
  end
end
