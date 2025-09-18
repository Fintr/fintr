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
          # Direct database query to get user role
          result = ActiveRecord::Base.connection.execute(
            "SELECT r.name FROM roles r 
             INNER JOIN users_roles ur ON r.id = ur.role_id 
             WHERE ur.user_id = '#{user.id}' 
             AND r.resource_type = '#{space.class.name}' 
             AND r.resource_id = '#{space.id}' 
             LIMIT 1"
          )
          
          result.first&.[]('name') || "member"
        end
      end
    end
  end
end