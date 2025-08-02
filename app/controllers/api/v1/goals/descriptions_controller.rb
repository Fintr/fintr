# frozen_string_literal: true

module Api
  module V1
    module Goals
      class DescriptionsController < ApiController
        def update
          params = with_current_params(goal_params)
          operation = ::Goals::Operations::UpdateGoalDescription.new.call(params)
          return render_unprocessable_entity(details: operation.failure) unless operation.success?

          render_success(data: operation.value!)
        end

        private

        def goal_params
          params.permit(:description)
        end
      end
    end
  end
end
