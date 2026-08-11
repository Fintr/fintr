# frozen_string_literal: true

module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      Rails.logger.info "[ActionCable] 🔌 Connection attempt"
      self.current_user = find_verified_user
      Rails.logger.info "[ActionCable] ✅ Connected as user: #{current_user&.id}"
    rescue => e
      Rails.logger.error "[ActionCable] ❌ Connection failed: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      reject_unauthorized_connection
    end

    private

    def find_verified_user
      token = token_from_request
      return reject_unauthorized_connection unless token

      validation_response = validate_token(token)
      return reject_unauthorized_connection if validation_response.error

      auth_id = validation_response.decoded_token.token.first["sub"]
      user = find_or_create_user(auth_id, validation_response.decoded_token.token.first)
      return reject_unauthorized_connection unless user

      user
    end

    def token_from_request
      # Try query parameter first (for WebSocket connections)
      # Action Cable passes query params in request.params
      token = request.params["token"] || request.query_parameters["token"]
      Rails.logger.info "[ActionCable] Token from params: #{token.present? ? 'present' : 'missing'}"
      return token if token.present?

      # Fall back to Authorization header (for HTTP connections)
      authorization_header_elements = request.headers["Authorization"]&.split
      Rails.logger.info "[ActionCable] Authorization header: #{authorization_header_elements.present? ? 'present' : 'missing'}"
      return nil unless authorization_header_elements
      return nil unless authorization_header_elements.length == 2

      scheme, token = authorization_header_elements
      return nil unless scheme.downcase == "bearer"

      token
    end

    def validate_token(token)
      response = Rails.cache.fetch("token:#{Digest::MD5.hexdigest(token)}", expires_in: 15.minutes) do
        Auth::Client.validate_token(token)
      end

      # If cached response is invalid, validate again
      if response.is_a?(Hash) || (response.respond_to?(:error) && response.error)
        response = Auth::Client.validate_token(token)
        Rails.cache.write("token:#{Digest::MD5.hexdigest(token)}", response)
      end

      response
    end

    def find_or_create_user(auth_id, token_data)
      key = Digest::MD5.hexdigest(auth_id)
      data = Auth::User.attributes_from_token_claims(token_data)

      user = Rails.cache.fetch("current_user_#{key}", expires_in: 1.hour) do
        result = Auth::Operations::EnsureAuthenticatedUser.new.call(data)
        result.success? ? result.value! : nil
      end
      return nil if user.blank?

      # Cache can return a stale user without picture; sync claims so photo_url
      # is available for presence avatars.
      sync_result = Auth::Operations::SyncUserFromAuthToken.new.call(
        data.merge(user:),
      )
      sync_result.success? ? sync_result.value! : user
    end

    def reject_unauthorized_connection
      reject
    end
  end
end
