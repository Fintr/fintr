# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Spaces
  module Operations
    class RemoveUser < Dry::Operation
      include Dry::Operation::Extensions::ActiveRecord
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
        
        transaction do
          current_user = step find_current_user(validated_params)
          target_user  = step find_target_user(validated_params)
          space        = step find_space(validated_params)
          _            = step validate_permissions(current_user, target_user, space)
          _            = step remove_user_from_space(space, target_user)
          _            = step remove_user_roles(space, target_user)
          
          { message: "User successfully removed from space" }
        end
      end

      private

      def find_current_user(params)
        user = Auth::User.find_by(id: params[:user_id])
        return Failure(errors: { user: ["not found"] }) unless user
        
        Success(user)
      end

      def find_target_user(params)
        user = Auth::User.find_by(id: params[:target_user_id])
        return Failure(errors: { target_user: ["not found"] }) unless user

        Success(user)
      end

      def find_space(params)
        space = Spaces::Space.find_by(id: params[:space_id])
        return Failure(errors: { space: ["not found"] }) unless space
        
        Success(space)
      end

      def validate_permissions(current_user, target_user, space)
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

      def remove_user_from_space(space, target_user)
        space_user = Spaces::SpaceUser.find_by(user: target_user, space: space)
        return Failure(errors: { user: ["User not found in this space"] }) unless space_user
        
        space_user.destroy!
        Success()
      end

      def remove_user_roles(space, target_user)
        # Remove all roles for this user in this space
        target_user.roles.where(resource: space).destroy_all
        Success()
      end
    end
  end
end
