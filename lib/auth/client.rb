# frozen_string_literal: true

require "jwt"
require "net/http"
require "openssl"
module Auth
  class Client
    def self.domain_url
      "#{ENV["AUTH0_URL"]}/"
    end

    def self.decode_token(token, jwks_hash)
      # Accept both API audience and client ID for audience validation
      # This allows tokens from both API and SPA clients (like Google OAuth)
      valid_audiences = [ENV["AUTH0_AUDIENCE"], ENV["AUTH0_CLIENT_ID"]].compact
      
      JWT.decode(token, nil, true, {
                  algorithm: "RS256",
                  iss: domain_url,
                  verify_iss: true,
                  aud: valid_audiences,
                  verify_aud: true,
                  jwks: { keys: jwks_hash[:keys] }
                })
    end

    def self.get_jwks
      jwks_uri = URI("#{domain_url}.well-known/jwks.json")

      http = Net::HTTP.new(jwks_uri.host, jwks_uri.port)
      configure_ssl(http:, uri: jwks_uri)

      request = Net::HTTP::Get.new(jwks_uri)
      http.request(request)
    rescue StandardError => e
      raise e
    end

    def self.configure_ssl(http:, uri:)
      return unless uri.scheme == "https"

      http.use_ssl = true

      # In development, be more lenient with SSL verification
      if Rails.env.development?
        http.verify_mode = OpenSSL::SSL::VERIFY_NONE
      else
        http.verify_mode = OpenSSL::SSL::VERIFY_PEER
        ca_file = find_certificate_file
        http.ca_file = ca_file if ca_file && File.exist?(ca_file)
      end
    end

    def self.find_certificate_file
      # Try Homebrew certificate location first (most up-to-date)
      homebrew_cert = "/opt/homebrew/etc/ca-certificates/cert.pem"
      return homebrew_cert if File.exist?(homebrew_cert)

      # Fall back to system default
      default_cert = OpenSSL::X509::DEFAULT_CERT_FILE
      return default_cert if File.exist?(default_cert)

      nil
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
      error = Error.new("Bad credentials: #{e.message}", :unauthorized)
      Response.new(nil, error)
    end
  end
end
