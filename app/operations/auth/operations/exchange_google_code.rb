# frozen_string_literal: true

require 'net/http'
require 'json'

module Auth
  module Operations
    class ExchangeGoogleCode < Dry::Operation
      def call(params)
        code = params[:code]
        state = params[:state]

        return Failure("Authorization code is required") if code.blank?
        return Failure("State parameter is required") if state.blank?

        result = exchange_code_for_tokens(code)

        return Failure(result.failure) unless result.success?

        Success(result.value!)
      end

      private

      def exchange_code_for_tokens(code)
        begin
          auth0_domain = ENV["AUTH0_DOMAIN"]
          client_id = ENV["AUTH0_CLIENT_ID"]
          client_secret = ENV["AUTH0_CLIENT_SECRET"]
          redirect_uri = "#{ENV["NEXT_PUBLIC_APP_BASE_URL"]}/auth/callback"

          uri = URI("https://#{auth0_domain}/oauth/token")
          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl = true

          request = Net::HTTP::Post.new(uri)
          request['Content-Type'] = 'application/json'

          request.body = {
            grant_type: 'authorization_code',
            client_id: client_id,
            client_secret: client_secret,
            code: code,
            redirect_uri: redirect_uri
          }.to_json

          response = http.request(request)
          data = JSON.parse(response.body)

          if response.code == '200'
            Success({
              access_token: data["access_token"],
              id_token: data["id_token"],
              refresh_token: data["refresh_token"],
              expires_in: data["expires_in"],
              token_type: data["token_type"],
              scope: data["scope"]
            })
          else
            Rails.logger.error "Auth0 token exchange failed: #{data}"
            Failure(data["error_description"] || data["error"] || "Token exchange failed")
          end
        rescue StandardError => e
          Rails.logger.error "Auth0 token exchange failed: #{e.message}"
          Failure("Token exchange failed: #{e.message}")
        end
      end
    end
  end
end

