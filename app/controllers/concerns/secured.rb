# frozen_string_literal: true

module Secured
  extend ActiveSupport::Concern

  REQUIRES_AUTHENTICATION = { message: "Requires authentication" }.freeze
  BAD_CREDENTIALS = {
    message: "Bad credentials"
  }.freeze
  MALFORMED_AUTHORIZATION_HEADER = {
    error: "invalid_request",
    error_description: "Authorization header value must follow this format: Bearer access-token",
    message: "Bad credentials"
  }.freeze
  INSUFFICIENT_PERMISSIONS = {
    error: "insufficient_permissions",
    error_description: "The access token does not contain the required permissions",
    message: "Permission denied"
  }.freeze

  def authorize
    token = token_from_request

    return if performed?

    validation_response(token)
    error = @validation_response.error
    return render json: { message: error.message }, status: error.status if error

    render json: { message: "User not found" }, status: :unauthorized unless current_user
  end

  # NOTE: Cached and invalid? Check again if the token is now valid.
  def validation_response(token)
    2.times do
      @validation_response = Rails.cache.fetch("token:#{Digest::MD5.hexdigest(token)}", expires_in: 15.minutes) do
        Auth::Client.validate_token(token)
      end
      break unless @validation_response.is_a?(Hash) || (@validation_response.respond_to?(:error) && @validation_response.error)

      @validation_response = Auth::Client.validate_token(token)
      Rails.cache.write("token:#{Digest::MD5.hexdigest(token)}", @validation_response)
    end
  end

  def current_user
    return @current_user if @current_user.present?
    return nil unless @validation_response&.decoded_token

    token_data = @validation_response.decoded_token.token.first
    auth_id = token_data["sub"]
    email = token_data["email"]
    # Auth0 may send "name" or "full_name"; prefer full_name, fall back to name
    full_name = token_data["full_name"].presence || token_data["name"].presence

    data = {
      auth_id:,
      email:,
      full_name:
    }

    result = Auth::Operations::CreateUserAndSpace.new.call(data)
    return render_not_found(details: result.failure) unless result.success?

    @current_user = result.value!

    # Track user activity when user is successfully authenticated
    track_user_activity if @current_user.present?

    @current_user
  end

  private

  def track_user_activity
    # Use a background job to avoid blocking the request. In development we use Solid Queue;
    # if no worker is running (common locally), perform_later never runs and analytics stay empty.
    args = {
      user_id: @current_user.id,
      activity_type: determine_activity_type
    }
    if Rails.env.development?
      UserActivityTrackingJob.perform_now(**args)
    else
      UserActivityTrackingJob.perform_later(**args)
    end
  rescue StandardError => e
    # Log error but don't fail the request
    Rails.logger.error "Failed to track user activity: #{e.message}"
  end

  def determine_activity_type
    # Determine activity type based on the request
    case request.path
    when /\/dashboard/
      "dashboard_viewed"
    when /\/transactions/
      "api_request"
    else
      "api_request"
    end
  end

  def token_from_request
    authorization_header_elements = request.headers["Authorization"]&.split

    render json: REQUIRES_AUTHENTICATION, status: :unauthorized and return unless authorization_header_elements

    unless authorization_header_elements.length == 2
      render json: MALFORMED_AUTHORIZATION_HEADER, status: :unauthorized and return
    end

    scheme, token = authorization_header_elements

    render json: { error: BAD_CREDENTIALS, data: { scheme:, token: } }, status: :unauthorized and return unless scheme.downcase == "bearer"

    token
  end
end
