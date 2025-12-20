# frozen_string_literal: true

module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
    end

    private

    def find_verified_user
      # Extract token from query string or headers
      token = request.params[:token] || extract_token_from_headers

      if token.blank?
        reject_unauthorized_connection
        return
      end

      # Verify token using Auth0 validation (same as Secured concern)
      validation_response = Auth::Client.validate_token(token)

      if validation_response.is_a?(Hash) || (validation_response.respond_to?(:error) && validation_response.error)
        Rails.logger.error("Action Cable: Invalid token")
        reject_unauthorized_connection
        return
      end

      # Get user from token
      auth_id = validation_response.decoded_token.token.first["sub"]
      data = {
        auth_id: auth_id,
        email: validation_response.decoded_token.token.first["email"],
        full_name: validation_response.decoded_token.token.first["full_name"]
      }

      result = Auth::Operations::CreateUserAndSpace.new.call(data)

      if result.success?
        result.value!
      else
        Rails.logger.error("Action Cable: Failed to create/find user: #{result.failure}")
        reject_unauthorized_connection
      end
    rescue StandardError => e
      Rails.logger.error("Action Cable connection error: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
      reject_unauthorized_connection
    end

    def extract_token_from_headers
      # Try Authorization header: Bearer <token>
      auth_header = request.headers["Authorization"]
      return nil unless auth_header

      auth_header.split(" ").last if auth_header.start_with?("Bearer ")
    end
  end
end
