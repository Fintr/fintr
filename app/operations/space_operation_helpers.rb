# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Operations
  class SpaceOperationHelpers < Dry::Operation
    include Dry::Operation::Extensions::ActiveRecord

    private

    # Common user finder methods
    def find_user(params)
      user = Auth::User.find_by(id: params[:user_id])
      return Failure(errors: { user: ["not found"] }) unless user
      
      Success(user)
    end

    def find_user_by_email(email)
      user = Auth::User.find_by(email: email)
      return Failure(errors: { email: ["User not found. User must have an account first."] }) unless user
      
      Success(user)
    end

    def find_target_user(params)
      user = Auth::User.find_by(id: params[:target_user_id])
      return Failure(errors: { target_user: ["not found"] }) unless user
      
      Success(user)
    end

    # Common space finder methods
    def find_space(params)
      space = Spaces::Space.find_by(id: params[:space_id])
      return Failure(errors: { space: ["not found"] }) unless space
      
      Success(space)
    end

    def find_space_by_id(space_id)
      space = Spaces::Space.find_by(id: space_id)
      return Failure(errors: { space: ["not found"] }) unless space
      
      Success(space)
    end

    def find_space_by_code(space_code)
      space = Spaces::Space.find_by(code: space_code)
      return Failure(errors: { space: ["not found"] }) unless space
      
      Success(space)
    end

    # Common role assignment methods
    def assign_admin_role(user, space)
      user.add_role(:admin, space)
      Success()
    rescue => e
      Failure(errors: { role: ["Failed to assign admin role: #{e.message}"] })
    end

    def assign_member_role(user, space)
      user.add_role(:member, space)
      Success()
    rescue => e
      Failure(errors: { role: ["Failed to assign member role: #{e.message}"] })
    end

    def remove_user_roles(user, space)
      user.roles.where(resource: space).destroy_all
      Success()
    rescue => e
      Failure(errors: { role: ["Failed to remove user roles: #{e.message}"] })
    end

    # Common space user methods
    def find_space_user(user, space)
      space_user = Spaces::SpaceUser.find_by(user: user, space: space)
      return Failure(errors: { user: ["User not found in this space"] }) unless space_user
      
      Success(space_user)
    end

    def remove_user_from_space(user, space)
      space_user = Spaces::SpaceUser.find_by(user: user, space: space)
      return Failure(errors: { user: ["User not found in this space"] }) unless space_user
      
      space_user.destroy!
      Success()
    rescue => e
      Failure(errors: { user: ["Failed to remove user from space: #{e.message}"] })
    end

    # Common permission checks
    def check_admin_permission(user, space)
      unless user.has_role?(:admin, space)
        return Failure(errors: { permission: ["Only admins can perform this action"] })
      end
      
      Success()
    end

    def check_space_membership(user, space)
      unless user.spaces.include?(space)
        return Failure(errors: { user: ["User does not belong to this space"] })
      end
      
      Success()
    end
  end
end
