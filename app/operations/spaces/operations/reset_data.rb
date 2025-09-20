# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Spaces
  module Operations
    class ResetData < Dry::Operation
      include Dry::Operation::Extensions::ActiveRecord
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).filled(:string)
          required(:user_id).filled(:string)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        validated_params = step validate(params:)
        space = step find_space(params: validated_params)
        user = step find_user(params: validated_params)
        transaction do
          _ = step delete_data(space:, user:)
          _ = step populate_initial_data(space:, user:)
        end

        params
      end

      def find_space(params:)
        space = Spaces::Space.find_by(id: params[:space_id])
        return Failure(space: ["not found"]) unless space

        Success(space)
      end

      def find_user(params:)
        user = Auth::User.find_by(id: params[:user_id])
        return Failure(user: ["not found"]) unless user

        Success(user)
      end

      def delete_data(space:, user:)
        space.budgets.destroy_all
        space.transactions.destroy_all
        space.transfers.destroy_all
        space.categories.destroy_all
        space.accounts.destroy_all
        space.goal_description&.destroy
        user.onboarding&.destroy
        Success()
      end

      def populate_initial_data(space:, user:)
        space.create_default_transaction_categories
        Onboarding.create(user:, step: "income")
        Success()
      end
    end
  end
end
