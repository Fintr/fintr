# frozen_string_literal: true

require "net/http"
require "json"

module Auth
  module Operations
    class RegisterUser < Dry::Operation
      def call(params)
        validated = step validate_signup_params(params)
        step create_auth0_database_user(validated)
        step exchange_password_for_tokens(validated)
      end

      private

      def validate_signup_params(params)
        email = params[:email]
        password = params[:password]
        full_name = params[:full_name] || "#{params[:first_name]} #{params[:last_name]}".strip

        return Failure("Email is required") if email.blank?
        return Failure("Password is required") if password.blank?
        return Failure("Full name is required") if full_name.blank?

        Success(email:, password:, full_name:)
      end

      def create_auth0_database_user(validated)
        auth0_domain = ENV["AUTH0_DOMAIN"]
        client_id = ENV["AUTH0_CLIENT_ID"]
        connection = ENV["AUTH0_CONNECTION"] || "Username-Password-Authentication"

        return Failure("Auth0 signup is not configured") if auth0_domain.blank? || client_id.blank?

        uri = URI("https://#{auth0_domain}/dbconnections/signup")
        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl = true

        request = Net::HTTP::Post.new(uri)
        request["Content-Type"] = "application/json"
        request.body = {
          client_id: client_id,
          email: validated[:email],
          password: validated[:password],
          connection: connection,
          name: validated[:full_name],
          user_metadata: {
            full_name: validated[:full_name]
          }
        }.to_json

        response = http.request(request)
        data = JSON.parse(response.body)

        if response.code == "200" && data["_id"].present?
          Success(data)
        else
          Rails.logger.error "Auth0 signup failed: #{data}"
          Failure(signup_error_message(data))
        end
      rescue StandardError => e
        Rails.logger.error "Auth0 signup failed: #{e.message}"
        Failure("Registration failed: #{e.message}")
      end

      def signup_error_message(data)
        return data["description"] if data["description"].is_a?(String)
        return data["message"] if data["message"].is_a?(String)
        return data["error"] if data["error"].is_a?(String)

        "Registration failed"
      end

      def exchange_password_for_tokens(validated)
        result = Auth::PasswordGrantTokenExchange.call(
          username: validated[:email],
          password: validated[:password]
        )

        return result if result.success?

        Failure(
          "Account created but sign-in failed. Please log in with your email and password."
        )
      end
    end
  end
end
