module Api
  module V1
    class SpacesController < ApiController
      skip_before_action :ensure_space_access!, only: [:index, :show, :create, :join]

      # GET /api/v1/spaces
      # Returns all spaces accessible to the current user
      def index
        spaces = current_user.spaces
        render_success(
          data: { spaces: spaces.map { |space| serialize_space(space) } }
        )
      end

      # GET /api/v1/spaces/:id
      # Returns detailed information about a specific space
      # Can accept either space ID (UUID) or space code
      def show
        # Try to find by ID first (UUID), then by code
        space = current_user.spaces.find { |s| s.id == params[:id] } || 
                current_user.spaces.find { |s| s.code == params[:id] }
        
        return render_not_found(details: "Space not found") unless space

        render_success(data: { space: serialize_space(space) })
      end

      # POST /api/v1/spaces
      # Creates a new organization space
      def create
        operation = ::Spaces::Operations::CreateOrganizationSpace.new.call(
          with_current_params(create_params)
        )
        return render_unprocessable_content(details: operation.failure) unless operation.success?

        render_created(record: operation.value!)
      end

      # POST /api/v1/spaces/:code/join
      # Joins an existing space (with invitation code)
      def join
        operation = ::Spaces::Operations::JoinSpace.new.call(
          with_current_params(join_params)
        )
        return render_unprocessable_content(details: operation.failure) unless operation.success?

        render_success(data: operation.value!)
      end

      # DELETE /api/v1/spaces/:code/leave
      # Leaves a space (if not the owner)
      def leave
        operation = ::Spaces::Operations::LeaveSpace.new.call(
          with_current_params(leave_params)
        )
        return render_unprocessable_content(details: operation.failure) unless operation.success?

        render_success(message: "Successfully left the space")
      end

      private

      def create_params
        params.permit(:name, :currency, :access_code)
      end

      def join_params
        params.permit(:access_code)
      end

      def leave_params
        params.permit(:code)
      end

      def serialize_space(space)
        {
          id: space.id,
          code: space.code,
          name: space.name,
          type: space.type,
          currency: space.currency,
          isPersonal: space.is_a?(::Spaces::PersonalSpace),
          isOrganization: space.is_a?(::Spaces::OrganizationSpace),
          userRole: get_user_role(space),
          createdAt: space.created_at,
          updatedAt: space.updated_at
        }
      end

      def get_user_role(space)
        # Direct database query to get user role
        result = ActiveRecord::Base.connection.execute(
          "SELECT r.name FROM roles r 
           INNER JOIN users_roles ur ON r.id = ur.role_id 
           WHERE ur.user_id = '#{current_user.id}' 
           AND r.resource_type = '#{space.class.name}' 
           AND r.resource_id = '#{space.id}' 
           LIMIT 1"
        )
        
        result.first&.[]('name') || "member"
      end
    end
  end
end