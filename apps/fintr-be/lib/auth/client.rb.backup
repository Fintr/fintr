# frozen_string_literal: true

require "jwt"
require "net/http"
module Auth
  class Client
    def self.domain_url
      "#{ENV["AUTH0_URL"]}/"
    end

    def self.decode_token(token, jwks_hash)
      JWT.decode(token, nil, true, {
                  algorithm: "RS256",
                  iss: domain_url,
                  verify_iss: true,
                  aud: ENV["AUTH0_AUDIENCE"],
                  verify_aud: true,
                  jwks: { keys: jwks_hash[:keys] }
                })
    end

    def self.get_jwks
      jwks_uri = URI("#{domain_url}.well-known/jwks.json")
      Net::HTTP.get_response jwks_uri
    rescue StandardError => e
      puts("Error fetching JWKS: on #{jwks_uri} #{e.message}")
      raise e
    end

    # Token Validation
    def self.validate_token(token)
      jwks_response = get_jwks

      unless jwks_response.is_a? Net::HTTPSuccess
        error = Error.new(message: "Unable to verify credentials", status: :internal_server_error)
        return Response.new(nil, error)
      end

      jwks_hash = JSON.parse(jwks_response.body).deep_symbolize_keys

      decoded_token = decode_token(token, jwks_hash)

      Response.new(Token.new(decoded_token), nil)
    rescue JWT::VerificationError, JWT::DecodeError => e
      puts("Error decoding token: #{e.message}. token: #{token}")
      error = Error.new("Bad credentials: #{e.message}", :unauthorized)
      Response.new(nil, error)
    end
  end
end
