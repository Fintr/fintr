# frozen_string_literal: true

module Api
  module V1
    module E2e
      class TestSetupController < ApplicationController
        skip_before_action :authorize

        before_action :ensure_development!

        def setup
          user = ::Auth::User.find_by(email: ::Auth::PlaywrightPersonalWorkspace.email)
          return render_not_found(message: "Playwright personal workspace user not found") unless user

          space = user.personal_spaces.first
          return render_not_found(message: "Playwright personal workspace not found") unless space

          render json: {
            user_id: user.id,
            email: user.email,
            auth_id: user.auth_id,
            space_code: space.code,
          }
        end

        def reset
          render json: {
            message: "Personal workspace reset is disabled so Playwright does not wipe real data.",
          }
        end

        private

        def ensure_development!
          return if Rails.env.development? || Rails.env.test?

          render json: { message: "Not found" },
                 status: :not_found
        end
      end
    end
  end
end
