# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Spaces
  module Operations
    class GrantAccess < Dry::Operation
      include Dry::Operation::Extensions::ActiveRecord
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

        result = transaction do
          inviter        = step find_inviter(validated_params)
          target_user    = step find_user(validated_params)
          space_user     = step create_invitation(validated_params, target_user, inviter)
          _              = step assign_role(validated_params, target_user)

          {
            access_link: generate_access_link(validated_params, space_user),
            user: target_user,
            space_user: space_user
          }
        end

        Achievements::EventHook.evaluate(
          user_id: validated_params[:user_id],
          space_id: validated_params[:space_id],
          event: "access_granted",
        )

        result
      end

      private

      def find_inviter(params)
        user = Auth::User.find_by(id: params[:user_id])
        return Failure(errors: { user: ["not found"] }) unless user

        Success(user)
      end

      def find_user(params)
        user = Auth::User.find_by(email: params[:email])

        if user.nil?
          # For now, return failure - user must exist to be granted access
          return Failure(errors: { email: ["User not found. User must have an account first."] })
        end

        Success(user)
      end

      def create_invitation(params, target_user, inviter)
        space = Spaces::Space.find(params[:space_id])

        # Check if user already belongs to this space
        return Failure(errors: { user: ["already belongs to this space"] }) if
          target_user.spaces.include?(space)

        space_user = Spaces::SpaceUser.create!(
          space: space,
          user: target_user,
          invited_by: inviter,
          invitation_status: "pending"
        )

        Success(space_user)
      rescue ActiveRecord::RecordInvalid => e
        Failure(errors: e.record.errors.full_messages, error: e, expected: true)
      end

      def assign_role(params, target_user)
        space = Spaces::Space.find(params[:space_id])
        role_name = params[:role] == "admin" ? "admin" : "member"

        target_user.add_role(role_name.to_sym, space)
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
