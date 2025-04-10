# frozen_string_literal: true

class ApplicationController < ActionController::API
  respond_to :json

  # Skip authentication by default, to be enabled in controllers that need it
  def authenticate_user!
    # This method is empty to allow controllers to override it with the
    # concern JwtAuthenticable
  end

  protected

  # Method to check if a user is authenticated, without requiring authentication
  def user_signed_in?
    current_user.present?
  end

  # Method to get the current user if a valid token is present
  def current_user
    @current_user ||= begin
      if request.headers["Authorization"].present?
        token = request.headers["Authorization"].split(" ").last

        begin
          decoded_token = JWT.decode(
            token,
            ENV.fetch("AUTH0_API_SIGNING_SECRET"),
            true,
            { algorithm: "HS256" }
          )

          payload = decoded_token.first
          User.find_by(auth0_id: payload["sub"])
        rescue JWT::DecodeError, JWT::ExpiredSignature
          nil
        end
      end
    end
  end

  private
end
