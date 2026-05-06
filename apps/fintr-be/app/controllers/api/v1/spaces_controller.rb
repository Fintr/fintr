# frozen_string_literal: true

module Api
  module V1
    class SpacesController < ApiController
      skip_before_action :ensure_space_access!, only: [:index, :show, :create, :join]

      # GET /api/v1/spaces
      # Returns all spaces accessible to the current user (both personal and organization spaces)
      def index
        # Eager load associations to prevent N+1 queries
        spaces = current_user.spaces.includes(:space_users, :users)
        render_success(
          data: {
            spaces: ::Spaces::Serializers::SpaceSerializer.render_as_hash(spaces, current_user: current_user)
          }
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

        render_success(
          data: { space: ::Spaces::Serializers::SpaceSerializer.render_as_hash(space, current_user: current_user) }
        )
      end

      # POST /api/v1/spaces
      # Creates a new organization space
      def create
        operation = ::Spaces::Operations::CreateOrganizationSpace.new.call({
          **with_current_params(create_params),
          reference_space_id: current_space.id.to_s
        })
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

      # POST /api/v1/spaces/:id/mark_seen
      # Marks the space invitation as seen for the current user
      def mark_seen
        space = current_user.spaces.find { |s| s.id == params[:id] || s.code == params[:id] }
        return render_not_found(details: "Space not found") unless space

        space_user = space.space_users.find_by(user_id: current_user.id)
        space_user&.mark_invitation_seen!

        render_success(message: "Invitation marked as seen")
      end

      # PATCH /api/v1/spaces/:id
      # Updates a space (admin only)
      def update
        operation = ::Spaces::Operations::UpdateSpace.new.call(
          with_current_params(update_params).merge(space_id: params[:id])
        )
        return render_unprocessable_content(details: operation.failure) unless operation.success?

        render_success(
          data: {
            space: ::Spaces::Serializers::SpaceSerializer.render_as_hash(operation.value!, current_user: current_user)
          }
        )
      end

      # DELETE /api/v1/spaces/:id
      # Deletes a space (owner only)
      def destroy
        space = find_space_by_id_or_code
        return render_not_found(details: "Space not found") unless space

        operation = ::Spaces::Operations::DeleteSpace.new.call(
          user_id: current_user.id.to_s,
          space_id: space.id.to_s
        )
        return render_unprocessable_content(details: operation.failure) unless operation.success?

        render_success(message: "Space deleted successfully")
      end

      # POST /api/v1/spaces/:id/transfer_ownership
      # Transfers ownership to another user (owner only)
      def transfer_ownership
        space = find_space_by_id_or_code
        return render_not_found(details: "Space not found") unless space

        operation = ::Spaces::Operations::TransferOwnership.new.call(
          user_id: current_user.id.to_s,
          space_id: space.id.to_s,
          new_owner_id: params[:new_owner_id]
        )
        return render_unprocessable_content(details: operation.failure) unless operation.success?

        render_success(
          message: "Ownership transferred successfully",
          data: {
            space: ::Spaces::Serializers::SpaceSerializer.render_as_hash(operation.value![:space], current_user: current_user)
          }
        )
      end

      private

      def find_space_by_id_or_code
        current_user.spaces.find { |s| s.id == params[:id] || s.code == params[:id] }
      end

      def create_params
        params.permit(:name, :currency, :access_code)
      end

      def join_params
        params.permit(:access_code)
      end

      def leave_params
        params.permit(:code)
      end

      def update_params
        params.permit(:name, :currency, :default_transaction_currency)
      end
    end
  end
end
