# frozen_string_literal: true

module Api
  module V1
    module Auth
      class PrivateController < ApiController
        before_action :authorize

        skip_before_action :ensure_space_access!

        def private
          personal_space = current_user.personal_spaces.first
          organization_spaces = current_user.organization_spaces

          render_success(data: {
            is_admin: current_user.has_role?(:admin),
            space_code: personal_space.code,
            personal_space: personal_space,
            organization_spaces: organization_spaces,
            onboarding_step: current_user.onboarding&.reload&.step || "",
            desktop_tutorial: current_user.desktop_tutorial,
            mobile_tutorial: current_user.mobile_tutorial
          })
        end

        def private_scoped
          validate_permissions ["read:messages"] do
            render json: { message: "Hello from a private endpoint! You need to be authenticated and have a scope of read:messages to see this." }
          end
        end
      end
    end
  end
end
