# frozen_string_literal: true

require "rails_helper"
require "action_cable/connection/test_case"

RSpec.describe ApplicationCable::Connection, type: :channel do
  let(:user) { create(:user) }
  let(:auth_id) { "auth0|123456" }
  let(:auth_token) { "test_token_123" }
  let(:token_data) do
    {
      "sub" => auth_id,
      "email" => user.email,
      "full_name" => user.full_name
    }
  end
  let(:decoded_token) { Auth::Token.new([token_data]) }
  let(:validation_response) { Auth::Response.new(decoded_token, nil) }
  let(:operation_double) { instance_double(Auth::Operations::CreateUserAndSpace) }

  before do
    allow(Auth::Client).to receive(:validate_token).and_return(validation_response)
    allow(Auth::Operations::CreateUserAndSpace).to receive(:new).and_return(operation_double)
    allow(operation_double).to receive(:call).and_return(Dry::Monads::Result::Success.new(user))
  end

  describe "#connect" do
    context "when token is provided in query params" do
      it "connects successfully" do
        connect "/cable?token=#{auth_token}"

        expect(connection.current_user).to eq(user)
      end

      it "calls CreateUserAndSpace with correct data" do
        connect "/cable?token=#{auth_token}"

        expect(operation_double).to have_received(:call).with(
          hash_including(
            auth_id: auth_id,
            email: user.email,
            full_name: user.full_name
          )
        )
      end
    end

    context "when token is provided in Authorization header" do
      it "connects successfully" do
        connect "/cable", headers: { "Authorization" => "Bearer #{auth_token}" }

        expect(connection.current_user).to eq(user)
      end

      it "extracts token from Bearer header" do
        connect "/cable", headers: { "Authorization" => "Bearer #{auth_token}" }

        expect(Auth::Client).to have_received(:validate_token).with(auth_token)
      end
    end

    context "when token is missing" do
      it "rejects connection" do
        expect do
          connect "/cable"
        end.to have_rejected_connection
      end

      it "does not call Auth::Client.validate_token" do
        begin
          connect "/cable"
        rescue ActionCable::Connection::Authorization::UnauthorizedError
          # Expected
        end

        expect(Auth::Client).not_to have_received(:validate_token)
      end
    end

    context "when token is blank" do
      it "rejects connection" do
        expect do
          connect "/cable?token="
        end.to have_rejected_connection
      end
    end

    context "when token validation returns Hash (error)" do
      it "rejects connection" do
        allow(Auth::Client).to receive(:validate_token).and_return({ error: "Invalid token" })

        expect do
          connect "/cable?token=#{auth_token}"
        end.to have_rejected_connection
      end

      it "logs error" do
        allow(Auth::Client).to receive(:validate_token).and_return({ error: "Invalid token" })
        allow(Rails.logger).to receive(:error)

        begin
          connect "/cable?token=#{auth_token}"
        rescue ActionCable::Connection::Authorization::UnauthorizedError
          # Expected
        end

        expect(Rails.logger).to have_received(:error).with("Action Cable: Invalid token")
      end
    end

    context "when token validation has error attribute" do
      it "rejects connection" do
        error_response = instance_double(Auth::Response, error: StandardError.new("Invalid"), decoded_token: nil)
        allow(Auth::Client).to receive(:validate_token).and_return(error_response)

        expect do
          connect "/cable?token=#{auth_token}"
        end.to have_rejected_connection
      end
    end

    context "when CreateUserAndSpace operation fails" do
      it "rejects connection" do
        allow(operation_double).to receive(:call).and_return(
          Dry::Monads::Result::Failure.new("User creation failed")
        )

        expect do
          connect "/cable?token=#{auth_token}"
        end.to have_rejected_connection
      end

      it "logs error with failure details" do
        failure = "User creation failed"
        allow(operation_double).to receive(:call).and_return(
          Dry::Monads::Result::Failure.new(failure)
        )
        allow(Rails.logger).to receive(:error)

        begin
          connect "/cable?token=#{auth_token}"
        rescue ActionCable::Connection::Authorization::UnauthorizedError
          # Expected
        end

        expect(Rails.logger).to have_received(:error).with(
          "Action Cable: Failed to create/find user: #{failure}"
        )
      end
    end

    context "when StandardError is raised" do
      it "rejects connection" do
        allow(Auth::Client).to receive(:validate_token).and_raise(StandardError.new("Unexpected error"))

        expect do
          connect "/cable?token=#{auth_token}"
        end.to have_rejected_connection
      end

      it "logs error with backtrace" do
        error = StandardError.new("Unexpected error")
        allow(error).to receive(:backtrace).and_return(["line1", "line2", "line3", "line4", "line5", "line6"])
        allow(Auth::Client).to receive(:validate_token).and_raise(error)
        allow(Rails.logger).to receive(:error)

        begin
          connect "/cable?token=#{auth_token}"
        rescue ActionCable::Connection::Authorization::UnauthorizedError
          # Expected
        end

        expect(Rails.logger).to have_received(:error).with(
          match(/Action Cable connection error: Unexpected error/)
        )
      end
    end
  end

  describe "#extract_token_from_headers" do
    context "when Authorization header is present with Bearer token" do
      it "extracts token correctly" do
        connect "/cable", headers: { "Authorization" => "Bearer #{auth_token}" }

        expect(Auth::Client).to have_received(:validate_token).with(auth_token)
      end
    end

    context "when Authorization header is missing" do
      it "returns nil" do
        connect "/cable?token=#{auth_token}"

        # Token should come from query params, not headers
        expect(connection.current_user).to eq(user)
      end
    end

    context "when Authorization header does not start with Bearer" do
      it "returns nil" do
        expect do
          connect "/cable", headers: { "Authorization" => "Basic #{auth_token}" }
        end.to have_rejected_connection
      end
    end

    context "when Authorization header has multiple spaces" do
      it "extracts token correctly" do
        connect "/cable", headers: { "Authorization" => "Bearer  #{auth_token}" }

        expect(Auth::Client).to have_received(:validate_token).with(auth_token)
      end
    end
  end
end
