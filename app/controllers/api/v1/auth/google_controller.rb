# frozen_string_literal: true

module Api
  module V1
    module Auth
      class GoogleController < ApiController
        skip_before_action :authorize
        skip_before_action :ensure_space_access!

        def callback
          # First exchange the code for tokens
          exchange_result = ::Auth::Operations::ExchangeGoogleCode.new.call(callback_params)

          unless exchange_result.success?
            return render_unauthorized(
              message: "Google sign-in failed",
              details: exchange_result.failure
            )
          end

          tokens = exchange_result.value!

          # For now, let's try to work with the tokens as-is
          # The frontend will handle the token format
          render_success(
            message: "Google sign-in successful",
            data: tokens
          )
        end

        private

        def callback_params
          params.permit(:code, :state).to_h
        end
      end
    end
  end
end

