# frozen_string_literal: true

module Auth
  module Operations
    class AuthenticateUser < Dry::Operation
      def initialize(auth0_client: nil)
        @auth0_client = auth0_client
      end

      def call(params)
        validated = step validate_credentials(params)
        step exchange_password_for_tokens(validated)
      end

      private

      def validate_credentials(params)
        username = params[:username]
        password = params[:password]

        return Failure("Username and password are required") if username.blank? || password.blank?

        Success(username:, password:)
      end

      def exchange_password_for_tokens(validated)
        Auth::PasswordGrantTokenExchange.call(
          username: validated[:username],
          password: validated[:password]
        )
      end
    end
  end
end
