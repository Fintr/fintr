# frozen_string_literal: true

module JwtAuthenticable
  extend ActiveSupport::Concern

  included do
    attr_reader :current_user
    before_action :authenticate_user!
  end

  private

  def authenticate_user!
    @current_user = authenticate_token
    render json: { error: "Unauthorized" }, status: :unauthorized unless @current_user
  end

  def authenticate_token
    return nil unless token_present?

    begin
      decoded_token = JWT.decode(
        token,
        auth0_api_signing_secret,
        true,
        { algorithm: "HS256" }
      )

      payload = decoded_token.first
      User.find_by(auth0_id: payload["sub"])
    rescue JWT::DecodeError, JWT::ExpiredSignature
      nil
    end
  end

  def token
    @token ||= request.headers.fetch("Authorization", "").split(" ").last
  end

  def token_present?
    request.headers["Authorization"].present? && request.headers["Authorization"].start_with?("Bearer ")
  end

  def auth0_api_signing_secret
    ENV.fetch("AUTH0_API_SIGNING_SECRET")
  end
end
