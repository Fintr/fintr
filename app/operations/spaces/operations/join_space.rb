require "dry/operation/extensions/active_record"

module Spaces
  module Operations
    class JoinSpace < Dry::Operation
      include Dry::Operation::Extensions::ActiveRecord
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled(:string)
          required(:access_code).filled(:string)
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
          space_user = step find_invitation(validated_params)
          _ = step validate_invitation(space_user)
          _ = step use_invitation(space_user, validated_params)
          _ = step assign_member_role(validated_params, space_user.space)
          space_user.space
        end
      end

      private

      def find_invitation(params)
        space_user = Spaces::SpaceUser.find_by(
          access_code: params[:access_code],
          invitation_status: 'pending'
        )
        return Failure(errors: { access: ["not found or expired"] }) unless space_user
        
        Success(space_user)
      end

      def validate_invitation(space_user)
        return Failure(errors: { access: ["has expired"] }) if space_user.invitation_expired?
        
        Success()
      end

      def use_invitation(space_user, params)
        user = Auth::User.find_by(id: params[:user_id])
        return Failure(errors: { user: ["not found"] }) unless user
        
        # Check if user already belongs to this space
        return Failure(errors: { user: ["already belongs to this space"] }) if 
          user.spaces.include?(space_user.space)
        
        space_user.use_invitation!(user)
        Success(space_user)
      end

      def assign_member_role(params, space)
        user = Auth::User.find_by(id: params[:user_id])
        return Failure(errors: { user: ["not found"] }) unless user
        
        user.add_role(:member, space)
        Success()
      end
    end
  end
end