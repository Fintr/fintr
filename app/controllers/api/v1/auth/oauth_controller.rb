# frozen_string_literal: true

module Api
  module V1
    module Auth
      # Generic OAuth callback controller
      # Handles callbacks from any OAuth provider (Google, Apple, etc.) via Auth0
      class OauthController < ApiController
        skip_before_action :authorize
        skip_before_action :ensure_space_access!

        def callback
          # Exchange the authorization code for tokens
          # This works for any OAuth provider (Google, Apple, etc.) since Auth0 handles the provider-specific details
          exchange_result = ::Auth::Operations::ExchangeGoogleCode.new.call(callback_params)

          unless exchange_result.success?
            return render_unauthorized(
              message: "OAuth sign-in failed",
              details: exchange_result.failure
            )
          end

          tokens = exchange_result.value!

          # Return tokens to frontend
          render_success(
            message: "Sign-in successful",
            data: tokens
          )
        end

        private

        def callback_params
          params.permit(
            :code,
            :state,
            :redirect_uri
          ).to_h
        end
      end
    end
  end
end
