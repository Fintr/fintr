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
          app_base_url = ENV["NEXT_PUBLIC_APP_BASE_URL"] || ENV["CLIENT_URL"]
          redirect_uri = "#{app_base_url}/auth-callback"

          # Validate required environment variables
          if auth0_domain.blank?
            Rails.logger.error "AUTH0_DOMAIN environment variable is not set"
            return Failure("Auth0 domain not configured")
          end

          if client_id.blank?
            Rails.logger.error "AUTH0_CLIENT_ID environment variable is not set"
            return Failure("Auth0 client ID not configured")
          end

          if client_secret.blank?
            Rails.logger.error "AUTH0_CLIENT_SECRET environment variable is not set"
            return Failure("Auth0 client secret not configured")
          end

          if app_base_url.blank?
            Rails.logger.error "NEXT_PUBLIC_APP_BASE_URL and CLIENT_URL environment variables are not set"
            return Failure("App base URL not configured")
          end

          Rails.logger.info "🔍 Google Token Exchange Debug:"
          Rails.logger.info "  - Auth0 Domain: #{auth0_domain}"
          Rails.logger.info "  - Client ID: #{client_id}"
          Rails.logger.info "  - App Base URL: #{app_base_url}"
          Rails.logger.info "  - Redirect URI: #{redirect_uri}"
          Rails.logger.info "  - Code: #{code[0..10]}..." if code

          uri = URI("https://#{auth0_domain}/oauth/token")
          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl = true

          request = Net::HTTP::Post.new(uri)
          request['Content-Type'] = 'application/json'

          request_body = {
            grant_type: 'authorization_code',
            client_id: client_id,
            client_secret: client_secret,
            code: code,
            redirect_uri: redirect_uri
          }

          # Add audience if available
          if ENV["AUTH0_AUDIENCE"].present?
            request_body[:audience] = ENV["AUTH0_AUDIENCE"]
          end

          # Request specific scopes to get regular JWT tokens
          request_body[:scope] = 'openid profile email read:current_user read:users read:transactions offline_access'
          
          # Add additional parameters to ensure JWT format
          request_body[:response_mode] = 'query'
          request_body[:response_type] = 'code'

          request.body = request_body.to_json

          response = http.request(request)
          data = JSON.parse(response.body)

          Rails.logger.info "🔍 Auth0 Response:"
          Rails.logger.info "  - Status Code: #{response.code}"
          Rails.logger.info "  - Response Body: #{data}"

          if response.code == '200'
            tokens = {
              access_token: data["access_token"],
              id_token: data["id_token"],
              refresh_token: data["refresh_token"],
              expires_in: data["expires_in"],
              token_type: data["token_type"],
              scope: data["scope"]
            }
            
            Rails.logger.info "🔍 Tokens to return:"
            Rails.logger.info "  - Access Token: #{tokens[:access_token]&.first(20)}..."
            Rails.logger.info "  - ID Token: #{tokens[:id_token]&.first(20)}..."
            Rails.logger.info "  - Refresh Token: #{tokens[:refresh_token]&.first(20)}..."
            Rails.logger.info "  - Expires In: #{tokens[:expires_in]}"
            Rails.logger.info "  - Token Type: #{tokens[:token_type]}"
            Rails.logger.info "  - Scope: #{tokens[:scope]}"
            
            # Check token format
            if tokens[:access_token]&.include?('..')
              Rails.logger.warn "⚠️  Access token appears to be encrypted (JWE format)"
            else
              Rails.logger.info "✅ Access token appears to be regular JWT"
            end
            
            if tokens[:id_token]&.include?('..')
              Rails.logger.warn "⚠️  ID token appears to be encrypted (JWE format)"
            else
              Rails.logger.info "✅ ID token appears to be regular JWT"
            end
            
            Success(tokens)
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

