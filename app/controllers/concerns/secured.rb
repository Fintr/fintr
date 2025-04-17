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

    puts("token: #{token}")

    return if performed?

    @validation_response = Auth::Client.validate_token(token)
    puts("validation_response: #{@validation_response.inspect}")

    current_user

    return unless (error = @validation_response.error)

    render json: { message: error.message }, status: error.status
  end

  def current_user
    return @current_user if @current_user.present?
    return nil unless @validation_response&.decoded_token

    auth_id = @validation_response.decoded_token.token.first["sub"]
    data = {
      auth_id:,
      email: @validation_response.decoded_token.token.first["email"],
      full_name: @validation_response.decoded_token.token.first["full_name"]
    }
    result = Auth::Operations::CreateUserAndSpace.new.call(data)
    return nil unless result.success?

    @current_user = result.value!
  end

  private

  def token_from_request
    authorization_header_elements = request.headers["Authorization"]&.split

    puts("authorization_header_elements: #{authorization_header_elements.inspect}")

    render json: REQUIRES_AUTHENTICATION, status: :unauthorized and return unless authorization_header_elements

    unless authorization_header_elements.length == 2
      render json: MALFORMED_AUTHORIZATION_HEADER, status: :unauthorized and return
    end

    scheme, token = authorization_header_elements

    puts("scheme: #{scheme}, token: #{token}")

    render json: { error: BAD_CREDENTIALS, data: { scheme:, token: } }, status: :unauthorized and return unless scheme.downcase == "bearer"

    token
  end
end
