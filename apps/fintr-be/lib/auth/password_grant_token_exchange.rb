# frozen_string_literal: true

require "net/http"
require "json"

module Auth
  module PasswordGrantTokenExchange
    module_function

    def call(username:, password:)
      creds = PasswordGrantCredentials.fetch
      return Dry::Monads::Failure("Auth0 password grant is not configured") unless PasswordGrantCredentials.configured?

      uri = URI("https://#{creds[:auth0_domain]}/oauth/token")
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = true

      request = Net::HTTP::Post.new(uri)
      request["Content-Type"] = "application/json"
      request.body = {
        grant_type: "password",
        username: username,
        password: password,
        client_id: creds[:client_id],
        client_secret: creds[:client_secret],
        audience: creds[:audience],
        scope: PasswordGrantCredentials::TOKEN_SCOPE
      }.to_json

      response = http.request(request)
      data = JSON.parse(response.body)

      if response.code == "200"
        Dry::Monads::Success({
          access_token: data["access_token"],
          id_token: data["id_token"],
          refresh_token: data["refresh_token"],
          expires_in: data["expires_in"],
          token_type: data["token_type"],
          scope: data["scope"]
        })
      else
        Rails.logger.error "Auth0 password grant failed: #{data}"
        Dry::Monads::Failure("Invalid credentials")
      end
    rescue StandardError => e
      Rails.logger.error "Auth0 password grant failed: #{e.message}"
      Dry::Monads::Failure("Invalid credentials")
    end
  end
end
