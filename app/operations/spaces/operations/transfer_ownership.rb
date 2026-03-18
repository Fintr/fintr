# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Spaces
  module Operations
    class TransferOwnership < Dry::Operation
      include Dry::Operation::Extensions::ActiveRecord
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled(:string)
          required(:space_id).filled(:string)
          required(:new_owner_id).filled(:string)
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
          new_owner    = step find_new_owner(validated_params)
          space        = step find_space(validated_params)
          _            = step validate_ownership(current_user, space)
          _            = step validate_new_owner_membership(new_owner, space)
          _            = step transfer_ownership(space, new_owner)
          _            = step ensure_new_owner_admin_role(new_owner, space)

          {
            message: "Ownership successfully transferred",
            space: space,
            new_owner: new_owner
          }
        end
      end

      private

      def find_current_user(params)
        user = Auth::User.find_by(id: params[:user_id])
        return Failure(errors: { user: ["not found"] }) unless user

        Success(user)
      end

      def find_new_owner(params)
        user = Auth::User.find_by(id: params[:new_owner_id])
        return Failure(errors: { new_owner: ["not found"] }) unless user

        Success(user)
      end

      def find_space(params)
        space = Spaces::Space.find_by(id: params[:space_id])
        return Failure(errors: { space: ["not found"] }) unless space

        Success(space)
      end

      def validate_ownership(current_user, space)
        unless space.owned_by?(current_user)
          return Failure(errors: { permission: ["Only the space owner can transfer ownership"] })
        end

        Success()
      end

      def validate_new_owner_membership(new_owner, space)
        # Use exists? instead of include? to avoid loading all spaces into memory
        unless new_owner.spaces.exists?(id: space.id)
          return Failure(errors: { new_owner: ["New owner must be a member of the space"] })
        end

        Success()
      end

      def transfer_ownership(space, new_owner)
        old_owner_id = space.owner_id
        space.update!(owner: new_owner)

        Rails.logger.info("[TransferOwnership] Space #{space.id} ownership transferred: #{old_owner_id} -> #{new_owner.id}")
        Success()
      rescue ActiveRecord::RecordInvalid => e
        Rails.logger.error("[TransferOwnership] Failed to transfer ownership for space #{space.id}: #{e.message}")
        Failure(errors: { space: ["Failed to transfer ownership: #{e.message}"] })
      end

      def ensure_new_owner_admin_role(new_owner, space)
        new_owner.add_role(:admin, space) unless new_owner.has_role?(:admin, space)
        Success()
      end
    end
  end
end
