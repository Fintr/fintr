# frozen_string_literal: true

module Goals
  module Operations
    class UpdateGoalDescription < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          optional(:user_id).maybe(:string)
          required(:space_id).filled(:string)
          required(:description).filled(:string)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params        = step validate(params:)
        space         = step find_space(params:)
        goal_desc     = step find_or_create_goal_description(space:)
        updated_goal  = step update_goal_description(params:, goal_desc:)
        updated_goal
      end

      def find_space(params:)
        Success(Spaces::Space.find(params[:space_id]))
      rescue ActiveRecord::RecordNotFound
        Failure(space_id: "Space not found")
      end

      def find_or_create_goal_description(space:)
        Success(
          space.goal_description ||
            GoalDescription.create(space: space, description: "")
        )
      end

      def update_goal_description(params:, goal_desc:)
        goal_desc.update(description: params[:description])
        Success()
      rescue ActiveRecord::ActiveRecordError => e
        Failure(description: e.message)
      end
    end
  end
end
