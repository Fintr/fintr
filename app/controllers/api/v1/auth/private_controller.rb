# frozen_string_literal: true

module Api
  module V1
    module Auth
      class PrivateController < ApiController
        before_action :authorize

        def private
          personal_space = current_user.personal_spaces.first
          organization_spaces = current_user.organization_spaces

          render_success(data: {
            space_code: personal_space.code,
            personal_space: personal_space,
            organization_spaces: organization_spaces
          })
        end

        def private_scoped
          validate_permissions [ "read:messages" ] do
            render json: { message: "Hello from a private endpoint! You need to be authenticated and have a scope of read:messages to see this." }
          end
        end
      end
    end
  end
end
