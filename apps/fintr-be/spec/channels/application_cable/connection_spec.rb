# frozen_string_literal: true

require "rails_helper"

RSpec.describe ApplicationCable::Connection, type: :channel do
  let(:user) { create(:user, auth_id: "auth0|123456", email: "test@example.com", full_name: "Test User") }
  let(:auth_token) { "test_token_123" }
  let(:auth_id) { "auth0|123456" }
  let(:token_data) do
    {
      "sub" => auth_id,
      "email" => user.email,
      "full_name" => user.full_name
    }
  end
  let(:decoded_token) { Auth::Token.new([token_data]) }
  let(:validation_response) { Auth::Response.new(decoded_token, nil) }
  let(:error_response) { Auth::Response.new(nil, Auth::Error.new("Invalid token", :unauthorized)) }

  # Create a testable connection class that exposes private methods
  let(:test_connection_class) do
    Class.new(described_class) do
      public :token_from_request, :validate_token, :find_or_create_user, :find_verified_user, :reject_unauthorized_connection

      def initialize(request_stub)
        @request_stub = request_stub
        @reject_called = false
        # Don't call super - we're testing in isolation
      end

      def request
        @request_stub
      end

      def reject
        @reject_called = true
      end

      def reject_called?
        @reject_called
      end
    end
  end

  let(:request_stub) do
    instance_double(ActionDispatch::Request).tap do |request|
      allow(request).to receive(:params).and_return({})
      allow(request).to receive(:query_parameters).and_return({})
      allow(request).to receive(:headers).and_return({})
    end
  end

  let(:connection) { test_connection_class.new(request_stub) }

  describe "#token_from_request" do
    context "when token is in query parameters" do
      it "returns token from request.params" do
        allow(request_stub).to receive(:params).and_return("token" => auth_token)
        expect(connection.token_from_request).to eq(auth_token)
      end

      it "returns token from request.query_parameters" do
        allow(request_stub).to receive(:query_parameters).and_return("token" => auth_token)
        expect(connection.token_from_request).to eq(auth_token)
      end

      it "logs token presence" do
        allow(request_stub).to receive(:params).and_return("token" => auth_token)
        expect(Rails.logger).to receive(:info).with("[ActionCable] Token from params: present")
        connection.token_from_request
      end
    end

    context "when token is in Authorization header" do
      it "returns token from Bearer Authorization header" do
        allow(request_stub).to receive(:headers).and_return("Authorization" => "Bearer #{auth_token}")
        expect(connection.token_from_request).to eq(auth_token)
      end

      it "returns nil when Authorization header is missing" do
        allow(request_stub).to receive(:headers).and_return({})
        expect(connection.token_from_request).to be_nil
      end

      it "returns nil when Authorization header has wrong format" do
        allow(request_stub).to receive(:headers).and_return("Authorization" => "InvalidFormat")
        expect(connection.token_from_request).to be_nil
      end

      it "returns nil when Authorization header is not Bearer" do
        allow(request_stub).to receive(:headers).and_return("Authorization" => "Basic #{auth_token}")
        expect(connection.token_from_request).to be_nil
      end

      it "logs authorization header presence" do
        allow(request_stub).to receive(:headers).and_return("Authorization" => "Bearer #{auth_token}")
        expect(Rails.logger).to receive(:info).with("[ActionCable] Token from params: missing")
        expect(Rails.logger).to receive(:info).with("[ActionCable] Authorization header: present")
        connection.token_from_request
      end
    end

    context "when no token is present" do
      it "returns nil" do
        allow(request_stub).to receive(:query_parameters).and_return({})
        allow(request_stub).to receive(:headers).and_return({})
        expect(connection.token_from_request).to be_nil
      end

      it "logs token missing" do
        allow(request_stub).to receive(:query_parameters).and_return({})
        allow(request_stub).to receive(:headers).and_return({})
        expect(Rails.logger).to receive(:info).with("[ActionCable] Token from params: missing")
        expect(Rails.logger).to receive(:info).with("[ActionCable] Authorization header: missing")
        connection.token_from_request
      end
    end
  end

  describe "#validate_token" do
    context "when token is cached and valid" do
      it "returns cached validation response" do
        cache_key = "token:#{Digest::MD5.hexdigest(auth_token)}"
        allow(Rails.cache).to receive(:fetch).with(cache_key, expires_in: 15.minutes).and_return(validation_response)
        expect(connection.validate_token(auth_token)).to eq(validation_response)
      end
    end

    context "when token is cached but invalid" do
      it "validates token again" do
        cache_key = "token:#{Digest::MD5.hexdigest(auth_token)}"
        allow(Rails.cache).to receive(:fetch).with(cache_key, expires_in: 15.minutes).and_return(error_response)
        allow(Auth::Client).to receive(:validate_token).with(auth_token).and_return(validation_response)
        allow(Rails.cache).to receive(:write).with(cache_key, validation_response)
        expect(connection.validate_token(auth_token)).to eq(validation_response)
      end

      it "writes new validation response to cache" do
        cache_key = "token:#{Digest::MD5.hexdigest(auth_token)}"
        allow(Rails.cache).to receive(:fetch).with(cache_key, expires_in: 15.minutes).and_return(error_response)
        allow(Auth::Client).to receive(:validate_token).with(auth_token).and_return(validation_response)
        expect(Rails.cache).to receive(:write).with(cache_key, validation_response)
        connection.validate_token(auth_token)
      end
    end

    context "when token is not cached" do
      it "validates token via Auth::Client" do
        cache_key = "token:#{Digest::MD5.hexdigest(auth_token)}"
        allow(Rails.cache).to receive(:fetch).with(cache_key, expires_in: 15.minutes).and_yield
        allow(Auth::Client).to receive(:validate_token).with(auth_token).and_return(validation_response)
        expect(connection.validate_token(auth_token)).to eq(validation_response)
      end
    end
  end

  describe "#find_or_create_user" do
    context "when user is cached" do
      it "returns cached user" do
        cache_key = "current_user_#{Digest::MD5.hexdigest(auth_id)}"
        allow(Rails.cache).to receive(:fetch).with(cache_key, expires_in: 1.hour).and_return(user)
        expect(connection.find_or_create_user(auth_id, token_data)).to eq(user)
      end
    end

    context "when user is not cached" do
      let(:operation) { instance_double(Auth::Operations::EnsureAuthenticatedUser) }
      let(:success_result) { Dry::Monads::Result::Success.new(user) }

      before do
        cache_key = "current_user_#{Digest::MD5.hexdigest(auth_id)}"
        allow(Rails.cache).to receive(:fetch).with(cache_key, expires_in: 1.hour).and_yield
        allow(Auth::Operations::EnsureAuthenticatedUser).to receive(:new).and_return(operation)
        allow(operation).to receive(:call).with(
          hash_including(
            auth_id: auth_id,
            email: token_data["email"],
            full_name: token_data["full_name"]
          )
        ).and_return(success_result)
      end

      it "calls EnsureAuthenticatedUser operation" do
        expect(operation).to receive(:call).with(
          hash_including(
            auth_id: auth_id,
            email: token_data["email"],
            full_name: token_data["full_name"]
          )
        )
        connection.find_or_create_user(auth_id, token_data)
      end

      it "returns user when operation succeeds" do
        expect(connection.find_or_create_user(auth_id, token_data)).to eq(user)
      end

      it "returns nil when operation fails" do
        failure_result = Dry::Monads::Result::Failure.new({ errors: "Some error" })
        allow(operation).to receive(:call).and_return(failure_result)
        expect(connection.find_or_create_user(auth_id, token_data)).to be_nil
      end
    end
  end

  describe "#find_verified_user" do
    context "when token is missing" do
      it "calls reject_unauthorized_connection" do
        allow(connection).to receive(:token_from_request).and_return(nil)
        expect(connection).to receive(:reject_unauthorized_connection)
        connection.find_verified_user
      end
    end

    context "when token validation fails" do
      it "calls reject_unauthorized_connection" do
        allow(connection).to receive(:token_from_request).and_return(auth_token)
        allow(connection).to receive(:validate_token).with(auth_token).and_return(error_response)
        expect(connection).to receive(:reject_unauthorized_connection)
        connection.find_verified_user
      end
    end

    context "when user creation fails" do
      it "calls reject_unauthorized_connection" do
        allow(connection).to receive(:token_from_request).and_return(auth_token)
        allow(connection).to receive(:validate_token).with(auth_token).and_return(validation_response)
        allow(connection).to receive(:find_or_create_user).with(auth_id, token_data).and_return(nil)
        expect(connection).to receive(:reject_unauthorized_connection)
        connection.find_verified_user
      end
    end

    context "when all steps succeed" do
      it "returns the user" do
        allow(connection).to receive(:token_from_request).and_return(auth_token)
        allow(connection).to receive(:validate_token).with(auth_token).and_return(validation_response)
        allow(connection).to receive(:find_or_create_user).with(auth_id, token_data).and_return(user)
        expect(connection.find_verified_user).to eq(user)
      end
    end
  end

  describe "#reject_unauthorized_connection" do
    it "calls reject" do
      connection.reject_unauthorized_connection
      expect(connection.reject_called?).to be true
    end
  end

  describe "#connect" do
    context "when connection is successful" do
      before do
        cache_key = "token:#{Digest::MD5.hexdigest(auth_token)}"
        user_cache_key = "current_user_#{Digest::MD5.hexdigest(auth_id)}"
        allow(request_stub).to receive(:params).and_return("token" => auth_token)
        allow(Rails.cache).to receive(:fetch).with(cache_key, expires_in: 15.minutes).and_return(validation_response)
        allow(Rails.cache).to receive(:fetch).with(user_cache_key, expires_in: 1.hour).and_return(user)
      end

      it "sets current_user" do
        connection.connect
        expect(connection.current_user).to eq(user)
      end

      it "logs connection attempt" do
        expect(Rails.logger).to receive(:info).with("[ActionCable] 🔌 Connection attempt").ordered
        expect(Rails.logger).to receive(:info).with(match(/\[ActionCable\] Token from params:/)).ordered
        expect(Rails.logger).to receive(:info).with(match(/\[ActionCable\] ✅ Connected as user:/)).ordered
        connection.connect
      end
    end

    context "when connection fails" do
      before do
        allow(connection).to receive(:token_from_request).and_raise(StandardError.new("Connection error"))
        allow(connection).to receive(:reject_unauthorized_connection)
      end

      it "rejects the connection" do
        connection.connect
        expect(connection).to have_received(:reject_unauthorized_connection)
      end

      it "logs the error" do
        expect(Rails.logger).to receive(:info).with("[ActionCable] 🔌 Connection attempt")
        expect(Rails.logger).to receive(:error).with("[ActionCable] ❌ Connection failed: Connection error")
        expect(Rails.logger).to receive(:error)
        connection.connect
      end
    end
  end
end
