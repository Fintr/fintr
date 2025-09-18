# frozen_string_literal: true

module Spaces
  module Operations
    class GrantAccess < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled(:string)
          required(:space_id).filled(:string)
          required(:space_code).filled(:string)
          required(:email).filled(:string)
          required(:role).filled(:string)
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
          target_user = step find_or_create_user(validated_params)
          space_user = step create_invitation(validated_params, target_user)
          _ = step assign_role(validated_params, target_user)
          
          { 
            access_link: generate_access_link(validated_params, space_user),
            user: target_user,
            space_user: space_user
          }
        end
      end

      private

      def find_or_create_user(params)
        user = Auth::User.find_by(email: params[:email])
        
        if user.nil?
          # For now, return failure - user must exist to be granted access
          return Failure(errors: { email: ["User not found. User must have an account first."] })
        end
        
        Success(user)
      end

      def create_invitation(params, target_user)
        space = Spaces::Space.find(params[:space_id])
        
        # Check if user already belongs to this space
        return Failure(errors: { user: ["already belongs to this space"] }) if 
          target_user.spaces.include?(space)
        
        space_user = Spaces::SpaceUser.create!(
          space: space,
          user: target_user,
          invited_by: Auth::User.find(params[:user_id]),
          invitation_status: 'pending'
        )
        
        Success(space_user)
      rescue ActiveRecord::RecordInvalid => e
        Failure(errors: e.record.errors.full_messages)
      end

      def assign_role(params, target_user)
        space = Spaces::Space.find(params[:space_id])
        role_name = params[:role] == 'admin' ? 'admin' : 'member'
        
        # Use the specific space type class for role assignment
        resource_class = space.class.name
        
        # Direct role assignment to bypass rolify issues
        role = Auth::Role.create!(
          name: role_name,
          resource_type: resource_class,
          resource_id: space.id
        )
        
        # Add to users_roles join table
        ActiveRecord::Base.connection.execute(
          "INSERT INTO users_roles (user_id, role_id) VALUES ('#{target_user.id}', '#{role.id}')"
        )
        
        Success()
      rescue => e
        Failure(errors: { role: ["Failed to assign role: #{e.message}"] })
      end

      def generate_access_link(params, space_user)
        # In a real implementation, this would be a full URL
        "#{params[:space_code]}/join/#{space_user.access_code}"
      end
    end
  end
end
