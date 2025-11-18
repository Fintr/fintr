# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Spaces
  module Operations
    class UpdateSpace < Dry::Operation
      include Dry::Operation::Extensions::ActiveRecord
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled(:string)
          required(:space_id).filled(:string)
          required(:name).filled(:string)
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
          user  = step find_user(validated_params)
          space = step find_space(validated_params)
          _     = step validate_user_access(user, space)
          _     = step update_space(space, validated_params)

          space.reload
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

      def validate_user_access(user, space)
        return Failure(errors: { access: ["user does not have access to this space"] }) unless
          user.spaces.include?(space)

        return Failure(errors: { access: ["admin access required"] }) unless
          user.has_role?(:admin, space)

        Success()
      end

      def update_space(space, params)
        space.update!(name: params[:name])
        Success(space)
      rescue ActiveRecord::RecordInvalid => e
        Failure(errors: e.record.errors.full_messages, error: e, expected: true)
      end
    end
  end
end
