# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Auth::Signup", type: :request do
  describe "POST /api/v1/auth/signup" do
    let(:params) do
      {
        email: "new.user@example.com",
        password: "Str0ng!Password",
        first_name: "New",
        last_name: "User"
      }
    end
    let(:register_user) { instance_double(Auth::Operations::RegisterUser) }
    let(:rate_limit_store) { Api::V1::Auth::SignupController.cache_store }

    before do
      allow(Auth::Operations::RegisterUser).to receive(:new).and_return(register_user)
      allow(register_user).to receive(:call).and_return(Dry::Monads::Success(access_token: "token"))
    end

    context "when the IP is within the signup rate limit" do
      before do
        allow(rate_limit_store).to receive(:increment).and_return(5)
        post "/api/v1/auth/signup", params:
      end

      it "returns ok" do
        expect(response).to have_http_status(:ok)
      end
    end

    context "when the IP exceeds the per-minute signup rate limit" do
      before do
        allow(rate_limit_store).to receive(:increment).and_return(6)
        post "/api/v1/auth/signup", params:
      end

      it "returns too many requests" do
        expect(response).to have_http_status(:too_many_requests)
      end

      it "returns the rate limit message" do
        expect(JSON.parse(response.body)["error"]["message"]).to eq("Too many signup attempts. Please try again later.")
      end

      it "does not register the user" do
        expect(register_user).not_to have_received(:call)
      end
    end

    context "when the IP exceeds the hourly signup rate limit" do
      before do
        allow(rate_limit_store).to receive(:increment) do |key, *|
          key.include?("short-term") ? 1 : 21
        end
        post "/api/v1/auth/signup", params:
      end

      it "returns too many requests" do
        expect(response).to have_http_status(:too_many_requests)
      end
    end
  end
end
