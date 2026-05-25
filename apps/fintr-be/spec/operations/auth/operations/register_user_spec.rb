# frozen_string_literal: true

require "rails_helper"

RSpec.describe Auth::Operations::RegisterUser, type: :operation do
  subject(:operation) { described_class.new }

  let(:params) do
    {
      email: "new.user@example.com",
      password: "Str0ng!Pass",
      first_name: "New",
      last_name: "User",
      full_name: "New User"
    }
  end

  describe "#call" do
    context "when required fields are missing" do
      it "returns a failure result" do
        result = operation.call(email: "", password: "", full_name: "")

        expect(result).to be_failure
      end
    end

    context "when Auth0 signup fails" do
      before do
        allow(operation).to receive(:create_auth0_database_user).and_return(
          Dry::Monads::Failure("Password is too weak")
        )
      end

      it "returns a failure result" do
        result = operation.call(params)

        expect(result).to be_failure
      end
    end

    context "when signup succeeds but password grant fails" do
      before do
        allow(operation).to receive(:create_auth0_database_user).and_return(
          Dry::Monads::Success("_id" => "auth0|123", "email" => params[:email])
        )
        allow(Auth::PasswordGrantTokenExchange).to receive(:call).and_return(
          Dry::Monads::Failure("Invalid credentials")
        )
      end

      it "returns a failure result" do
        result = operation.call(params)

        expect(result).to be_failure
      end

      it "asks the user to log in manually" do
        result = operation.call(params)

        expect(result.failure).to include("Please log in")
      end
    end

    context "when signup and password grant succeed" do
      let(:tokens) do
        {
          access_token: "access",
          id_token: "id",
          refresh_token: "refresh",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "openid"
        }
      end

      before do
        allow(operation).to receive(:create_auth0_database_user).and_return(
          Dry::Monads::Success("_id" => "auth0|123", "email" => params[:email])
        )
        allow(Auth::PasswordGrantTokenExchange).to receive(:call).and_return(
          Dry::Monads::Success(tokens)
        )
      end

      it "returns tokens for the frontend session" do
        result = operation.call(params)

        expect(result).to be_success
        expect(result.value!).to eq(tokens)
      end

      it "uses the same password grant exchange as login" do
        operation.call(params)

        expect(Auth::PasswordGrantTokenExchange).to have_received(:call).with(
          username: params[:email],
          password: params[:password]
        )
      end
    end
  end
end
