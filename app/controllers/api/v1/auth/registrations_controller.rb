# frozen_string_literal: true

module Api
  module V1
    module Auth
      class RegistrationsController < Devise::RegistrationsController
        respond_to :json

        def create
          user = User.new(user_params)
          profile = Profile.new(profile_params)
          profile.user = user
          if user.save && profile.save
            sign_in(user)

            render json: {
              status: { code: :ok, message: "User created successfully." },
              data: {
                user: user,
                profile: profile
              }
            }, status: :ok
          else
            render json: {
              status: { code: :unprocessable_entity, message: "User couldn't be created. #{user.errors.full_messages.to_sentence}" },
              errors: {
                user: user.errors,
                profile: profile.errors
              }
            }, status: :unprocessable_entity
          end
        end

        private

        def user_params
          params.require(:user).permit(:email, :password, :password_confirmation)
        end

        def profile_params
          params.require(:profile).permit(:first_name, :last_name, :phone_number)
        end
      end
    end
  end
end
