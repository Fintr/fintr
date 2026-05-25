# frozen_string_literal: true

require "net/http"
require "json"

module Auth
  module Operations
    class RefreshToken < Dry::Operation
      def call(params)
        refresh_token = params[:refresh_token]
        return Failure("Refresh token is required") if refresh_token.blank?

        step refresh_auth0_token(refresh_token)
      end

      private

      def refresh_auth0_token(refresh_token)
        creds = Auth::PasswordGrantCredentials.fetch
        return Failure("Auth0 token refresh is not configured") unless Auth::PasswordGrantCredentials.configured?

        uri = URI("https://#{creds[:auth0_domain]}/oauth/token")
        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl = true

        request = Net::HTTP::Post.new(uri)
        request["Content-Type"] = "application/json"
        request.body = {
          grant_type: "refresh_token",
          refresh_token: refresh_token,
          client_id: creds[:client_id],
          client_secret: creds[:client_secret],
          audience: creds[:audience],
          scope: Auth::PasswordGrantCredentials::TOKEN_SCOPE
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
          Rails.logger.error "Auth0 token refresh failed: #{data}"
          Failure("Token refresh failed")
        end
      rescue StandardError => e
        Rails.logger.error "Auth0 token refresh failed: #{e.message}"
        Failure("Token refresh failed")
      end
    end
  end
end
