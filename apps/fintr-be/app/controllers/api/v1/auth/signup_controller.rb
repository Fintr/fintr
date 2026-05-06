# frozen_string_literal: true

module Api
  module V1
    module Auth
      class SignupController < ApiController
        skip_before_action :authorize
        skip_before_action :ensure_space_access!

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
