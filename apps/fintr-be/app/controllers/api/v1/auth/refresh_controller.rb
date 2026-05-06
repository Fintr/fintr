# frozen_string_literal: true

module Api
  module V1
    module Auth
      class RefreshController < ApiController
        skip_before_action :authorize
        skip_before_action :ensure_space_access!

        def create
          result = ::Auth::Operations::RefreshToken.new.call(refresh_params)

          if result.success?
            render_success(data: result.value!)
          else
            render_unauthorized(message: result.failure)
          end
        end

        private

        def refresh_params
          # Handle both direct refresh_token and nested refresh[refresh_token] parameters
          refresh_token = params[:refresh_token] || params.dig(:refresh, :refresh_token)
          { refresh_token: refresh_token }
        end
      end
    end
  end
end
