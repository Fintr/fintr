# frozen_string_literal: true

require "net/http"
require "json"

module Auth
  module Operations
    class RegisterUser < Dry::Operation
      def call(params)
        email = params[:email]
        password = params[:password]
        full_name = params[:full_name] || "#{params[:first_name]} #{params[:last_name]}".strip

        return Failure("Email is required") if email.blank?
        return Failure("Password is required") if password.blank?
        return Failure("Full name is required") if full_name.blank?

        result = create_auth0_user(
          email:,
          password:,
          full_name:
        )

        return Failure(result.failure) unless result.success?

        Success(result.value!)
      end

      private

      def create_auth0_user(email:, password:, full_name:)
        begin
          auth0_domain = ENV["AUTH0_DOMAIN"]
          client_id = ENV["AUTH0_CLIENT_ID"]
          client_secret = ENV["AUTH0_CLIENT_SECRET"]
          audience = ENV["AUTH0_AUDIENCE"]
          connection = ENV["AUTH0_CONNECTION"] || "Username-Password-Authentication"

          uri = URI("https://#{auth0_domain}/dbconnections/signup")
          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl = true

          request = Net::HTTP::Post.new(uri)
          request["Content-Type"] = "application/json"

          request.body = {
            client_id: client_id,
            email: email,
            password: password,
            connection: connection,
            name: full_name,
            user_metadata: {
              full_name: full_name
            }
          }.to_json

          response = http.request(request)
          data = JSON.parse(response.body)

          if response.code == "200"
            login_result = auto_login(
              email:,
              password:,
              client_id:,
              client_secret:,
              audience:,
              auth0_domain:
            )
            return login_result if login_result.success?

            Success({
              email: data["email"],
              user_id: data["_id"],
              message: "Account created successfully. Please log in."
            })
          else
            Rails.logger.error "Auth0 signup failed: #{data}"
            Failure(data["description"] || data["error"] || "Registration failed")
          end
        rescue StandardError => e
          Rails.logger.error "Auth0 signup failed: #{e.message}"
          Failure("Registration failed: #{e.message}")
        end
      end

      def auto_login(email:, password:, client_id:, client_secret:, audience:, auth0_domain:)
        uri = URI("https://#{auth0_domain}/oauth/token")
        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl = true

        request = Net::HTTP::Post.new(uri)
        request["Content-Type"] = "application/json"

        request.body = {
          grant_type: "password",
          username: email,
          password: password,
          client_id: client_id,
          client_secret: client_secret,
          audience: audience,
          scope: "openid profile email read:current_user read:users read:transactions offline_access"
        }.to_json

        response = http.request(request)
        data = JSON.parse(response.body)

        if response.code == "200"
          Success({
            access_token: data["access_token"],
            id_token: data["id_token"],
            refresh_token: data["refresh_token"],
            expires_in: data["expires_in"],
            token_type: data["token_type"],
            scope: data["scope"]
          })
        else
          Rails.logger.error "Auto-login after signup failed: #{data}"
          Failure("Account created but auto-login failed. Please log in manually.")
        end
      rescue StandardError => e
        Rails.logger.error "Auto-login after signup failed: #{e.message}"
        Failure("Account created but auto-login failed. Please log in manually.")
      end
    end
  end
end
