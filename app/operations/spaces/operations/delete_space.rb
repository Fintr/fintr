# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Spaces
  module Operations
    class DeleteSpace < Dry::Operation
      include Dry::Operation::Extensions::ActiveRecord
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled(:string)
          required(:space_id).filled(:string)
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
          current_user = step find_user(validated_params)
          space        = step find_space(validated_params)
          _            = step validate_ownership(current_user, space)
          _            = step delete_space(space)

          { message: "Space successfully deleted" }
        end
      end

      private

      def find_user(params)
        user = Auth::User.find_by(id: params[:user_id])
        return Failure(errors: { user: ["not found"] }) unless user

        Success(user)
      end

      def find_space(params)
        space = Spaces::Space.find_by(id: params[:space_id])
        return Failure(errors: { space: ["not found"] }) unless space

        Success(space)
      end

      def validate_ownership(current_user, space)
        unless space.owned_by?(current_user)
          return Failure(errors: { permission: ["Only the space owner can delete this space"] })
        end

        Success()
      end

      def delete_space(space)
        space_id = space.id
        space_code = space.code
        space_name = space.name
        
        space.destroy!
        
        Rails.logger.info("[DeleteSpace] Space deleted: id=#{space_id}, code=#{space_code}, name=#{space_name}")
        Success()
      rescue ActiveRecord::RecordNotDestroyed => e
        Rails.logger.error("[DeleteSpace] Failed to delete space #{space.id}: #{e.message}")
        Failure(errors: { space: ["Failed to delete space: #{e.message}"] })
      end
    end
  end
end
