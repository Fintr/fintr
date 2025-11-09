# frozen_string_literal: true

module Auth
  module Operations
    class RefreshToken < Dry::Operation
      def call(params)
        refresh_token = params[:refresh_token]

        return Failure("Refresh token is required") if refresh_token.blank?

        result = refresh_auth0_token(refresh_token)
        
        return result if result.failure?

        Success(result.value!)
      end

      private

      def refresh_auth0_token(refresh_token)
        begin
          # Use direct HTTP request to Auth0's token endpoint
          # Use the same client credentials as the login endpoint (not M2M)
          auth0_domain = ENV["AUTH0_DOMAIN"]
          client_id = ENV["AUTH0_CLIENT_ID"]
          client_secret = ENV["AUTH0_CLIENT_SECRET"]
          audience = ENV["AUTH0_AUDIENCE"]

          uri = URI("https://#{auth0_domain}/oauth/token")
          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl = true

          request = Net::HTTP::Post.new(uri)
          request['Content-Type'] = 'application/json'
          
          request.body = {
            grant_type: 'refresh_token',
            refresh_token: refresh_token,
            client_id: client_id,
            client_secret: client_secret,
            audience: audience,
            scope: 'openid profile email read:current_user read:users read:transactions offline_access'
          }.to_json

          response = http.request(request)
          data = JSON.parse(response.body)

          if response.code == '200'
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
end
