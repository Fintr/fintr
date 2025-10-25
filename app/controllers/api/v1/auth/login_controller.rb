# frozen_string_literal: true

module Api
  module V1
    module Auth
      class LoginController < ApiController
        skip_before_action :authorize
        skip_before_action :current_space

        def create
          result = ::Auth::Operations::AuthenticateUser.new.call(login_params)

          if result.success?
            render_success(data: result.value!)
          else
            render_unauthorized(message: result.failure)
          end
        end

        private

        def login_params
          params.permit(:username, :password).to_h
        end
      end
    end
  end
end
