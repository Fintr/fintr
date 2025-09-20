module Api
  module V1
    module Spaces
      class UsersController < ApiController
        # GET /api/v1/spaces/:space_code/users
        def index
          ensure_space_admin!
          return if performed?

          users = current_space.users.includes(:roles)
          render_success(
            data: { users: users.map { |user| serialize_user(user) } }
          )
        end

        # POST /api/v1/spaces/:space_code/users/grant_access
        def grant_access
          ensure_space_admin!
          return if performed?

          operation = ::Spaces::Operations::GrantAccess.new.call(
            with_current_params(grant_access_params)
          )
          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_success(data: operation.value!)
        end

        # DELETE /api/v1/spaces/:space_code/users/:user_id
        def remove
          ensure_space_admin!
          return if performed?

          operation = ::Spaces::Operations::RemoveUser.new.call(
            with_current_params(remove_params).merge(target_user_id: params[:id])
          )
          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_success(message: "User removed from space")
        end

        private

        def grant_access_params
          params.permit(:email, :role)
        end

        def remove_params
          params.permit(:id)
        end

        def serialize_user(user)
          {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: get_user_role_for_space(user, current_space),
            joined_at: user.space_users.find_by(space: current_space)&.created_at
          }
        end

        def get_user_role_for_space(user, space)
          # Use Rolify to get user role for the specific space
          if user.has_role?(:admin, space)
            "admin"
          elsif user.has_role?(:member, space)
            "member"
          else
            "member" # Default fallback
          end
        end
      end
    end
  end
end