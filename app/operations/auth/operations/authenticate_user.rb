# frozen_string_literal: true

require "net/http"
require "json"

module Auth
  module Operations
    class AuthenticateUser < Dry::Operation
      def initialize(auth0_client: nil)
        @auth0_client = auth0_client
      end

      def call(params)
        username = params[:username]
        password = params[:password]

        return Failure("Username and password are required") if username.blank? || password.blank?

        # Use Auth0's Resource Owner Password Grant
        result = authenticate_with_auth0(username, password)

        return result if result.failure?

        Success(result.value!)
      end

      private

      def authenticate_with_auth0(username, password)
        begin
          # Use direct HTTP request to Auth0's token endpoint
          # This is more reliable than using the Auth0 gem for password grant
          auth0_domain = ENV["M2M_AUTH0_DOMAIN"]
          client_id = ENV["M2M_AUTH0_CLIENT_ID"]
          client_secret = ENV["M2M_AUTH0_CLIENT_SECRET"]
          audience = ENV["AUTH0_AUDIENCE"]

          uri = URI("https://#{auth0_domain}/oauth/token")
          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl = true

          request = Net::HTTP::Post.new(uri)
          request["Content-Type"] = "application/json"

          request.body = {
            grant_type: "password",
            username: username,
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
              token_type: data["token_type"]
            })
          else
            Rails.logger.error "Auth0 authentication failed: #{data}"
            Failure("Invalid credentials")
          end
        rescue StandardError => e
          Rails.logger.error "Auth0 authentication failed: #{e.message}"
          Failure("Invalid credentials")
        end
      end
    end
  end
end
