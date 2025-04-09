# frozen_string_literal: true

module Api
  module V1
    module Auth
      class UnlocksController < Devise::UnlocksController
        respond_to :json

        # GET /resource/unlock/new
        # def new
        #   super
        # end

        # POST /resource/unlock
        # def create
        #   super
        # end

        # GET /resource/unlock?unlock_token=abcdef
        # def show
        #   super
        # end

        # protected

        # The path used after sending unlock password instructions
        # def after_sending_unlock_instructions_path_for(resource)
        #   super(resource)
        # end

        # The path used after unlocking the resource
        # def after_unlock_path_for(resource)
        #   super(resource)
        # end

        private

        # Private methods can be added here
      end
    end
  end
end
