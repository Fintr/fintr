# frozen_string_literal: true

module Api
  module V1
    module Auth
      class GoogleController < ApiController
        skip_before_action :authorize
        skip_before_action :current_space

        def callback
          result = ::Auth::Operations::ExchangeGoogleCode.new.call(callback_params)

          if result.success?
            render_success(
              message: "Google sign-in successful",
              data: result.value!
            )
          else
            render_unauthorized(
              message: "Google sign-in failed",
              details: result.failure
            )
          end
        end

        private

        def callback_params
          params.permit(:code, :state).to_h
        end
      end
    end
  end
end

