# frozen_string_literal: true

module Api
  module V1
    module Auth
      class TutorialController < ApiController
        skip_before_action :ensure_space_access!

        def complete
          result = ::Auth::Operations::UpdateTutorialCompletion.new.call(
            user_id: current_user.id,
            platform: tutorial_params[:platform]
          )

          if result.success?
            render_success(
              message: "Tutorial completed successfully",
              data: result.value!
            )
          else
            render_unprocessable_content(details: result.failure)
          end
        end

        private

        def tutorial_params
          params.permit(:platform)
        end
      end
    end
  end
end


