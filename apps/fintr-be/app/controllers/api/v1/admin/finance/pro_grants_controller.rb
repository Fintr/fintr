# frozen_string_literal: true

module Api
  module V1
    module Admin
      module Finance
        class ProGrantsController < ApiController
          skip_before_action :ensure_space_access!
          before_action :ensure_admin!

          def index
            grants = ::Finance::ProGrant.recent.includes(:user)
            render_success(
              data: {
                grants: ::Admin::Serializers::ProGrantSerializer.render_as_hash(grants),
              },
            )
          end

          def create
            operation = ::Finance::Operations::ProGrants::GrantYear.new.call(
              email: pro_grant_params[:email],
              granted_by_id: current_user.id,
            )

            return render_unprocessable_content(details: operation.failure) unless operation.success?

            grant = operation.value!
            render_success(
              data: {
                grant: ::Admin::Serializers::ProGrantSerializer.render_as_hash(grant),
              },
              status: :created,
              message: "Fintr Pro granted for 1 year",
            )
          end

          private

          def ensure_admin!
            return if current_user.has_role?(:admin)

            render_error(
              message: "Permission denied",
              status: :forbidden,
            )
          end

          def pro_grant_params
            params.permit(:email)
          end
        end
      end
    end
  end
end
