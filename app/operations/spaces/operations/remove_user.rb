# frozen_string_literal: true

module Spaces
  module Operations
    class RemoveUser < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled(:string)
          required(:space_id).filled(:string)
          required(:space_code).filled(:string)
          required(:target_user_id).filled(:string)
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
          _ = step validate_permissions(validated_params)
          _ = step remove_user_from_space(validated_params)
          _ = step remove_user_roles(validated_params)
          
          { message: "User successfully removed from space" }
        end
      end

      private

      def validate_permissions(params)
        current_user = Auth::User.find(params[:user_id])
        space = Spaces::Space.find(params[:space_id])
        target_user = Auth::User.find(params[:target_user_id])
        
        # Admin can remove anyone except themselves
        unless current_user.has_role?(:admin, space)
          return Failure(errors: { permission: ["Only admins can remove users from space"] })
        end
        
        # Cannot remove yourself
        if current_user.id == target_user.id
          return Failure(errors: { permission: ["Cannot remove yourself from space"] })
        end
        
        Success()
      end

      def remove_user_from_space(params)
        space = Spaces::Space.find(params[:space_id])
        target_user = Auth::User.find(params[:target_user_id])
        
        space_user = Spaces::SpaceUser.find_by(user: target_user, space: space)
        return Failure(errors: { user: ["User not found in this space"] }) unless space_user
        
        space_user.destroy!
        Success()
      end

      def remove_user_roles(params)
        space = Spaces::Space.find(params[:space_id])
        target_user = Auth::User.find(params[:target_user_id])
        
        # Remove all roles for this user in this space
        target_user.roles.where(resource: space).destroy_all
        Success()
      end
    end
  end
end
