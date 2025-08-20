# frozen_string_literal: true

module Api
  module V1
    module Auth
      class UserController < ApiController
        skip_before_action :current_space

        def index
          method_used = current_user.auth_id.split("|").first
          result = {
            uses_email: method_used == "auth0"
          }

          render_success(data: result)
        end

        def update
          result = ::Auth::Operations::UpdateUserAuth0.new.call(
            user_params.merge(auth_id: current_user.auth_id)
          )

          if result.success?
            render_success(message: result.value!)
          else
            render_unprocessable_content(details: result.failure)
          end
        end

        def reset_password
          result = ::Auth::Operations::ResetPassword.new.call(
            auth_id: current_user.auth_id,
            email: params[:email]
          )

          if result.success?
            render_success(data: result.value!)
          else
          end
        end

        private

        def user_params
          params.permit(
            :name,
            :email
          )
        end
      end
    end
  end
end
