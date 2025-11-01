# frozen_string_literal: true

require 'net/http'
require 'json'

module Auth
  module Operations
    class HandleGoogleTokens < Dry::Operation
      def call(tokens)
        # Check if tokens are encrypted (JWE format)
        if encrypted_token?(tokens[:access_token])
          Rails.logger.info "🔓 Detected encrypted tokens, attempting to decrypt..."
          result = decrypt_tokens(tokens)
          return result
        else
          Rails.logger.info "✅ Tokens are already in JWT format"
          return Success(tokens)
        end
      end

      private

      def encrypted_token?(token)
        return false unless token
        # JWE tokens have 5 parts separated by dots: header..encrypted_key..iv..ciphertext..tag
        token.split('.').length == 5
      end

      def decrypt_tokens(tokens)
        begin
          # For now, we'll try to get fresh tokens with different parameters
          # This is a workaround for the encrypted token issue
          Rails.logger.warn "⚠️  Encrypted tokens detected - this requires Auth0 configuration changes"
          Rails.logger.warn "⚠️  Please check your Auth0 application settings to disable token encryption"
          
          # Return the tokens as-is for now, but log the issue
          Rails.logger.error "❌ Cannot process encrypted tokens with current setup"
          Failure("Encrypted tokens not supported - please configure Auth0 to return JWT tokens")
        rescue StandardError => e
          Rails.logger.error "Error handling encrypted tokens: #{e.message}"
          Failure("Token decryption failed: #{e.message}")
        end
      end
    end
  end
end
