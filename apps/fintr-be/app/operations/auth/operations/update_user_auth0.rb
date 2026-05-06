# frozen_string_literal: true

module Auth
  module Operations
    class UpdateUserAuth0 < Dry::Operation
      def initialize(auth0_client: Auth::M2mClient.client)
        @auth0_client = auth0_client
      end

      class Contract < Dry::Validation::Contract
        params do
          required(:auth_id).filled(:string)
          optional(:name).maybe(:string)
          optional(:email).maybe(:string)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(errors: contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        ActiveRecord::Base.transaction do
          params    = step validate(params:)
          user      = step find_user(params:)
          _         = step update_user(user:, params:)
          params    = step update_email_params(params:)
          _         = step update_auth0_user(params:)
          message   = step create_message(params:)
          message
        end
      end

      def update_email_params(params:)
        return Success(params) if params[:email].blank?

        params[:email] = params[:email].downcase
        params[:verify_email] = true
        Success(params)
      end

      def find_user(params:)
        Success(Auth::User.find_by!(auth_id: params[:auth_id]))
      rescue ActiveRecord::RecordNotFound
        Failure(auth_id: "User not found")
      end

      def update_user(user:, params:)
        user.update(
          full_name: params[:name],
          email: params[:email]
        )
        Success(user)
      rescue ActiveRecord::RecordInvalid => e
        Failure(**user.errors, error: e, expected: true)
      end

      def update_auth0_user(params:)
        auth_id = params[:auth_id]
        user_updates = params.slice(:name, :email, :verify_email).compact

        response = @auth0_client.patch_user(auth_id, user_updates)
        success = response["name"] == user_updates[:name] ||
                  response["email"] == user_updates[:email]
        success ? Success(response) : Failure(errors: response)
      rescue Auth0::Unauthorized => e
        # Token might be expired - reset the M2M client and retry once
        Rails.logger.warn "[UpdateUserAuth0] Auth0 Unauthorized error, resetting M2M client: #{e.message}"
        Auth::M2mClient.reset!

        # Retry with fresh token
        begin
          new_client = Auth::M2mClient.client
          response = new_client.patch_user(auth_id, user_updates)
          success = response["name"] == user_updates[:name] ||
                    response["email"] == user_updates[:email]
          success ? Success(response) : Failure(errors: response)
        rescue StandardError => retry_error
          Rails.logger.error "[UpdateUserAuth0] Retry failed: #{retry_error.message}"
          Failure(errors: "Auth0 update failed after retry: #{retry_error.message}")
        end
      rescue StandardError => e
        Rails.logger.error "[UpdateUserAuth0] Auth0 API error: #{e.class} - #{e.message}"
        Failure(errors: e.message)
      end



      def create_message(params:)
        message = if params[:email].present?
                    "Email updated successfully. " \
                    "Please check your email for verification. " \
                    "Be sure to check your spam folder also."
        else
                    "Name updated successfully"
        end

        Success(message)
      end
    end
  end
end
