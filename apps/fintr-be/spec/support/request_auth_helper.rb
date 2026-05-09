# frozen_string_literal: true

module RequestAuthHelper
  def setup_authentication(user:, space:, auth_id: "auth0|123456")
    # Create SpaceUser association if it doesn't exist
    unless Spaces::SpaceUser.exists?(user: user, space: space)
      create(:space_user, user: user, space: space)
    end

    # Create a valid-looking JWT token (header.payload.signature format)
    auth_token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIjeyBhdXRoX2lkIH0iLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJmdWxsX25hbWUiOiJUZXN0IFVzZXIifQ.signature"

    headers = {
      'Authorization' => "Bearer #{auth_token}",
      'X-Space-Code' => space.code
    }

    # Mock Auth token data
    token_data = {
      "sub" => auth_id,
      "email" => user.email,
      "full_name" => user.full_name
    }

    # Create token struct instance
    decoded_token = Auth::Token.new([token_data])

    # Create success response
    validation_response = Auth::Response.new(decoded_token, nil)

    # Mock the Auth::Client.validate_token method to return our success response
    allow(Auth::Client).to receive(:validate_token).with(auth_token).and_return(validation_response)

    # Mock the token validation caching
    allow(Rails.cache).to receive(:fetch).with("token:#{Digest::MD5.hexdigest(auth_token)}", expires_in: 15.minutes).and_return(validation_response)

    # Mock the user cache
    allow(Rails.cache).to receive(:fetch).with("current_user_#{Digest::MD5.hexdigest(auth_id)}", expires_in: 1.hour).and_return(user)

    # Mock EnsureAuthenticatedUser (resolves user without full provisioning on each request)
    operation_double = instance_double(Auth::Operations::EnsureAuthenticatedUser)
    allow(Auth::Operations::EnsureAuthenticatedUser).to receive(:new).and_return(operation_double)
    allow(operation_double).to receive(:call).and_return(Dry::Monads::Result::Success.new(user))

    # Mock space caching
    allow(Rails.cache).to receive(:fetch).with("current_space_#{space.code}", expires_in: 15.minutes).and_return(space)

    # Return all the auth-related objects
    {
      auth_id:,
      auth_token:,
      headers:,
      token_data:,
      decoded_token:,
      validation_response:
    }
  end
end

RSpec.configure do |config|
  config.include RequestAuthHelper, type: :request
end
