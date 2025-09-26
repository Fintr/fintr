# frozen_string_literal: true

module Api
  module V1
    class ApiController < ApplicationController
      include Secured
      include CurrentSpace

      before_action :authorize
      before_action :ensure_space_access!

      def with_current_params(params = {})
        params ||= {}
        params = params.merge(user_id: current_user.id)
        
        # Only add space context if current_space exists
        if current_space
          params = params.merge(space_id: current_space.id, space_code: current_space.code)
        end
        
        params
      end
    end
  end
end
