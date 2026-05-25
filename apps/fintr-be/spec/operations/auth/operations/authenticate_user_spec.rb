# frozen_string_literal: true

require "rails_helper"

RSpec.describe Auth::Operations::AuthenticateUser, type: :operation do
  subject(:operation) { described_class.new }

  describe "#call" do
    context "when username or password is blank" do
      it "returns a failure result" do
        result = operation.call(username: "", password: "secret")

        expect(result).to be_failure
      end

      it "does not wrap failures in an outer success" do
        result = operation.call(username: "", password: "secret")

        expect(result.success?).to be(false)
      end
    end

    context "when Auth0 rejects the credentials" do
      before do
        allow(Auth::PasswordGrantTokenExchange).to receive(:call).and_return(
          Dry::Monads::Failure("Invalid credentials")
        )
      end

      it "returns a failure result" do
        result = operation.call(username: "user@example.com", password: "wrong-password")

        expect(result).to be_failure
      end

      it "surfaces the invalid credentials message" do
        result = operation.call(username: "user@example.com", password: "wrong-password")

        expect(result.failure).to eq("Invalid credentials")
      end
    end

    context "when Auth0 returns tokens" do
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
        allow(Auth::PasswordGrantTokenExchange).to receive(:call).and_return(
          Dry::Monads::Success(tokens)
        )
      end

      it "returns token payload directly without nested success" do
        result = operation.call(username: "user@example.com", password: "good-password")

        expect(result).to be_success
        expect(result.value!).to eq(tokens)
      end
    end
  end
end
