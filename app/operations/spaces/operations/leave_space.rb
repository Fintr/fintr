# frozen_string_literal: true

module Spaces
  module Operations
    class LeaveSpace < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled(:string)
          required(:space_id).filled(:string)
          required(:space_code).filled(:string)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        validated_params = step validate(params:)
        
        ActiveRecord::Base.transaction do
          _ = step validate_can_leave(validated_params)
          _ = step remove_user_from_space(validated_params)
          _ = step remove_user_roles(validated_params)
          
          { message: "Successfully left the space" }
        end
      end

      private

      def validate_can_leave(params)
        current_user = Auth::User.find(params[:user_id])
        space = Spaces::Space.find(params[:space_id])
        
        # Check if user belongs to this space
        unless current_user.spaces.include?(space)
          return Failure(errors: { user: ["User does not belong to this space"] })
        end
        
        # Check if user is the space owner (admin who created it)
        if current_user.has_role?(:admin, space) && is_space_owner?(current_user, space)
          return Failure(errors: { permission: ["Space owner cannot leave the space"] })
        end
        
        Success()
      end

      def remove_user_from_space(params)
        space = Spaces::Space.find(params[:space_id])
        current_user = Auth::User.find(params[:user_id])
        
        space_user = Spaces::SpaceUser.find_by(user: current_user, space: space)
        return Failure(errors: { user: ["User not found in this space"] }) unless space_user
        
        space_user.destroy!
        Success()
      end

      def remove_user_roles(params)
        space = Spaces::Space.find(params[:space_id])
        current_user = Auth::User.find(params[:user_id])
        
        # Remove all roles for this user in this space
        current_user.roles.where(resource: space).destroy_all
        Success()
      end

      def is_space_owner?(user, space)
        # Check if this user created the space (first admin)
        # This is a simplified check - in a real app you might have a separate owner field
        user.roles.where(resource: space, name: 'admin').exists?
      end
    end
  end
end
