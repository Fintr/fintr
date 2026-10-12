# frozen_string_literal: true

module Api
  module V1
    module Auth
      class SignupController < ApiController
        skip_before_action :authorize
        skip_before_action :ensure_space_access!

        rate_limit to: 5,
                   within: 1.minute,
                   name: "short-term",
                   with: :render_too_many_signup_attempts,
                   only: :create
        rate_limit to: 20,
                   within: 1.hour,
                   name: "long-term",
                   with: :render_too_many_signup_attempts,
                   only: :create

        def create
          result = ::Auth::Operations::RegisterUser.new.call(signup_params)

          if result.success?
            render_success(
              message: "Account created successfully",
              data: result.value!
            )
          else
            render_unprocessable_content(
              message: "Registration failed",
              details: result.failure
            )
          end
        end

        private

        def render_too_many_signup_attempts
          render_error(
            message: "Too many signup attempts. Please try again later.",
            status: :too_many_requests
          )
        end

        def signup_params
          params.permit(
            :email,
            :password,
            :first_name,
            :last_name,
            :full_name
          ).to_h
        end
      end
    end
  end
end
