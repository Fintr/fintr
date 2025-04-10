# frozen_string_literal: true

module Api
  module V1
    module Auth
      class Auth0Controller < ApplicationController
        skip_before_action :verify_authenticity_token, raise: false

        def callback
          # Get access token from Auth0
          auth_info = request.env["omniauth.auth"]
          user = User.from_auth0(auth_info["extra"]["raw_info"])

          # Create a JWT token for the user
          token = issue_token(user)

          # Redirect to frontend with the token
          redirect_to "#{Rails.application.config.client_url}/auth/callback?token=#{token}"
        end

        def failure
          redirect_to "#{Rails.application.config.client_url}/auth/failure"
        end

        private

        def issue_token(user)
          payload = {
            sub: user.auth0_id,
            user_id: user.id,
            email: user.email,
            exp: 24.hours.from_now.to_i
          }

          JWT.encode(payload, auth0_api_signing_secret, "HS256")
        end

        def auth0_api_signing_secret
          ENV.fetch("AUTH0_API_SIGNING_SECRET")
        end
      end
    end
  end
end
