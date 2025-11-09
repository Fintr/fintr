# frozen_string_literal: true

require 'net/http'
require 'json'

module Auth
  module Operations
    class ExchangeGoogleCode < Dry::Operation
      def call(params)
        code = params[:code]
        state = params[:state]
        redirect_uri = params[:redirect_uri]

        return Failure("Authorization code is required") if code.blank?
        return Failure("State parameter is required") if state.blank?

        result = exchange_code_for_tokens(code, redirect_uri)

        return Failure(result.failure) unless result.success?

        Success(result.value!)
      end

      private

      def exchange_code_for_tokens(code, provided_redirect_uri = nil)
        begin
          auth0_domain = ENV["M2M_AUTH0_DOMAIN"]
          client_id = ENV["M2M_AUTH0_CLIENT_ID"]
          client_secret = ENV["M2M_AUTH0_CLIENT_SECRET"]

          # Validate required environment variables (always needed)
          if auth0_domain.blank?
            return Failure("Auth0 domain not configured")
          end

          if client_id.blank?
            return Failure("Auth0 client ID not configured")
          end

          if client_secret.blank?
            return Failure("Auth0 client secret not configured")
          end

          # Use provided redirect_uri if available (must match what was used in authorization request)
          # Otherwise fall back to constructing from app_base_url
          if provided_redirect_uri.present?
            redirect_uri = provided_redirect_uri
          else
            app_base_url = ENV["NEXT_PUBLIC_APP_BASE_URL"] || ENV["CLIENT_URL"]
            if app_base_url.blank?
              return Failure("App base URL not configured (required when redirect_uri is not provided)")
            end
            redirect_uri = "#{app_base_url}/auth-callback"
          end

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

          if response.code == '200'
            tokens = {
              access_token: data["access_token"],
              id_token: data["id_token"],
              refresh_token: data["refresh_token"],
              expires_in: data["expires_in"],
              token_type: data["token_type"],
              scope: data["scope"]
            }
            
            Success(tokens)
          else
            Failure(data["error_description"] || data["error"] || "Token exchange failed")
          end
        rescue StandardError => e
          Failure("Token exchange failed: #{e.message}")
        end
      end
    end
  end
end

