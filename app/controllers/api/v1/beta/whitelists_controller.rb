# frozen_string_literal: true

module Api
  module V1
    module Beta
      class WhitelistsController < ApiController
        before_action :authenticate_user!

        def show
          render_success(data: ::Beta::Whitelist.all)
        end

        def create
          whitelist = ::Beta::Whitelist.new(email: params[:email])

          if whitelist.save
            render_success(data: whitelist)
          else
            render_unprocessable_content(details: whitelist.errors.full_messages)
          end
        end

        def update
          whitelist = ::Beta::Whitelist.find(params[:id])

          if whitelist.update(email: params[:email])
            render_success(data: whitelist)
          else
            render_unprocessable_content(details: whitelist.errors.full_messages)
          end
        end

        def destroy
          whitelist = ::Beta::Whitelist.find(params[:id])

          if whitelist.destroy
            render_success(message: "Whitelist deleted")
          else
            render_unprocessable_content(details: whitelist.errors.full_messages)
          end
        end

        private

        def authenticate_user!
          return if current_user.has_role?(:admin)

          render_unauthorized(message: "Unauthorized")
        end
      end
    end
  end
end
